import { db, enrollments, eq, events, inArray, tickets, ticketTypes, users } from "@app/db";
import { enqueueMail } from "@app/mail";

/** The browser-facing origin, for links in mail. */
export const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

/** A same-site link, or the sign-up page that leads to it when nobody has registered `email` yet. */
export const accountLink = (path: string, hasAccount: boolean) =>
  hasAccount ? `${appUrl}${path}` : `${appUrl}/register?redirect=${encodeURIComponent(path)}`;

/** The registered accounts among `emails` (lowercase), so mail can say "sign in" or "sign up". */
export async function registeredEmails(emails: string[]) {
  if (emails.length === 0) return new Set<string>();
  const rows = await db.select({ email: users.email }).from(users).where(inArray(users.email, emails));
  return new Set(rows.map((row) => row.email));
}

/**
 * Emails every attendee of a confirmed enrollment their ticket. The ticket page needs an account
 * with the ticket's email, so attendees without one are sent to sign up first.
 * Never throws: the enrollment is already confirmed, and mail mustn't fail that.
 */
export async function sendTicketMails(enrollmentId: string) {
  try {
    const [order] = await db
      .select({
        title: events.title,
        venue: events.venue,
        startsAt: events.startsAt,
        ticketType: ticketTypes.name,
      })
      .from(enrollments)
      .innerJoin(events, eq(events.id, enrollments.eventId))
      .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
      .where(eq(enrollments.id, enrollmentId));
    if (!order) return;
    const rows = await db.select().from(tickets).where(eq(tickets.enrollmentId, enrollmentId));
    const registered = await registeredEmails([...new Set(rows.map((row) => row.email))]);
    const event = { title: order.title, venue: order.venue, startsAt: order.startsAt.toISOString() };

    await Promise.all(
      rows.map((ticket) => {
        const hasAccount = registered.has(ticket.email);
        return enqueueMail({
          to: ticket.email,
          template: "ticket",
          props: {
            name: `${ticket.firstName} ${ticket.lastName}`,
            email: ticket.email,
            ticketType: order.ticketType,
            event,
            code: ticket.code,
            url: accountLink(`/tickets/${ticket.id}`, hasAccount),
            hasAccount,
          },
        }).catch((error) => console.error("Failed to enqueue ticket mail", error));
      }),
    );
  } catch (error) {
    console.error("Failed to send ticket mail", error);
  }
}
