import { db, enrollments, eq, events, inArray, tickets, ticketTypes, users } from "@app/db";
import { enqueueMail } from "@app/mail";

/** The browser-facing origin, for links in mail. */
export const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

// mail is read away from the browser, so the time is spelled out in Thailand's zone
const mailTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Bangkok" });
export const formatMailTime = (date: Date) => mailTime.format(date);

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

    await Promise.all(
      rows.map((ticket) => {
        const hasAccount = registered.has(ticket.email);
        const name = Bun.escapeHTML(`${ticket.firstName} ${ticket.lastName}`);
        return enqueueMail({
          to: ticket.email,
          subject: `ตั๋วของคุณ: ${order.title}`,
          html:
            `<p>สวัสดีคุณ ${name}</p>` +
            `<p>ตั๋ว <strong>${Bun.escapeHTML(order.ticketType)}</strong> สำหรับอีเวนต์ <strong>${Bun.escapeHTML(order.title)}</strong> พร้อมแล้ว</p>` +
            `<p>วันเวลา: ${formatMailTime(order.startsAt)}<br>สถานที่: ${Bun.escapeHTML(order.venue)}<br>` +
            `รหัสตั๋ว: <strong style="font-family:monospace;letter-spacing:2px">${ticket.code}</strong></p>` +
            `<p>${hasAccount ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}ด้วยอีเมล ${Bun.escapeHTML(ticket.email)} เพื่อดูตั๋วและ QR code สำหรับเช็กอินที่หน้างาน</p>` +
            `<p><a href="${accountLink(`/tickets/${ticket.id}`, hasAccount)}">${hasAccount ? "ดูตั๋ว" : "สมัครสมาชิกและดูตั๋ว"}</a></p>`,
        }).catch((error) => console.error("Failed to enqueue ticket mail", error));
      }),
    );
  } catch (error) {
    console.error("Failed to send ticket mail", error);
  }
}
