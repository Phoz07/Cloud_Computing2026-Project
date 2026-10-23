// Ticket issuing shared by apps/registration (free tickets, approvals) and apps/payment (the
// Stripe webhook): which enrollments hold seats, confirming one, and mailing its tickets.
// See docs/tickets.md for the enrollment lifecycle.
export {
  activeEnrollment,
  confirmEnrollment,
  effectiveStatus,
  invitationTaken,
  markConfirmed,
  seatsTaken,
  type Tx,
} from "./enrollment";
export { EnrollmentClosed, EnrollmentNotFound, SoldOut } from "./errors";
export { accountLink, appUrl, formatMailTime, registeredEmails, sendTicketMails } from "./mail";

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U

/** A 10-character ticket code (50 random bits), what the ticket's QR code holds. */
export function ticketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
}
