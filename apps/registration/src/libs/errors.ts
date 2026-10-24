import { HTTPError } from "elysia";

// Same codes as apps/event, so the web reads them the same way.
export class EventNotFound extends HTTPError.id("EVENT_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบอีเวนต์นี้";
}

export class InviteOnly extends HTTPError.id("INVITE_ONLY", 403) {
  override readonly detail = "อีเวนต์นี้เปิดให้เฉพาะผู้ได้รับเชิญ";
}

export class EventSuspended extends HTTPError.id("EVENT_SUSPENDED", 403) {
  override readonly detail = "อีเวนต์นี้ถูกระงับ เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขได้";
}

export class TicketTypeNotFound extends HTTPError.id("TICKET_TYPE_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบประเภทตั๋วนี้";
}

export class TicketNotFound extends HTTPError.id("TICKET_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบตั๋วนี้";
}

/** A draft, scheduled or suspended event, or one that has ended. */
export class EnrollmentNotOpen extends HTTPError.id("ENROLLMENT_NOT_OPEN", 409) {
  override readonly detail = "อีเวนต์นี้ยังไม่เปิดหรือปิดรับลงทะเบียนแล้ว";
}

export class LimitReached extends HTTPError.id("LIMIT_REACHED", 409) {
  override readonly detail = "จำนวนตั๋วเกินกว่าที่ซื้อได้ต่อบัญชี";
}

export class NotInvited extends HTTPError.id("NOT_INVITED", 403) {
  override readonly detail = "ตั๋วประเภทนี้สำหรับผู้ได้รับเชิญเท่านั้น";
}

export class InvitationUsed extends HTTPError.id("INVITATION_USED", 409) {
  override readonly detail = "คำเชิญของคุณถูกใช้ลงทะเบียนแล้ว";
}

export class InvalidAnswers extends HTTPError.id("INVALID_ANSWERS", 422) {
  override readonly detail = "กรุณาตอบคำถามที่จำเป็นให้ครบ และเลือกจากตัวเลือกที่มีให้เท่านั้น";
}

export class EnrollmentNotPending extends HTTPError.id("ENROLLMENT_NOT_PENDING", 409) {
  override readonly detail = "รายการนี้ไม่ได้รอการอนุมัติแล้ว";
}

/** Only a ticket type with a quota (first_come) has seats to hold; the others enroll without a hold. */
export class NothingToHold extends HTTPError.id("NOTHING_TO_HOLD", 409) {
  override readonly detail = "ตั๋วประเภทนี้ไม่ต้องจองที่นั่งก่อนลงทะเบียน";
}

export class HoldExpired extends HTTPError.id("HOLD_EXPIRED", 409) {
  override readonly detail = "หมดเวลาจองที่นั่งแล้ว กรุณาจองใหม่";
}
