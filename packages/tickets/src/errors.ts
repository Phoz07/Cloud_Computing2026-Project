import { HTTPError } from "elysia";

export class EnrollmentNotFound extends HTTPError.id("ENROLLMENT_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบรายการลงทะเบียนนี้";
}

/** No seats left for the tickets asked for, or (after a lapsed hold) the invitation was used meanwhile. */
export class SoldOut extends HTTPError.id("SOLD_OUT", 409) {
  override readonly detail = "ตั๋วประเภทนี้เต็มแล้ว";
}

/** Rejected by the organizer, or the payment hold ran out. */
export class EnrollmentClosed extends HTTPError.id("ENROLLMENT_CLOSED", 409) {
  override readonly detail = "รายการลงทะเบียนนี้ถูกปฏิเสธหรือหมดเวลาชำระเงินแล้ว";
}
