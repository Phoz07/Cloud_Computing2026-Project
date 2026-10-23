import { HTTPError } from "elysia";

export class EventNotFound extends HTTPError.id("EVENT_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบอีเวนต์นี้";
}

/** An invite-only event, asked for by someone not signed in or signed in with an email that isn't invited. */
export class InviteOnly extends HTTPError.id("INVITE_ONLY", 403) {
  override readonly detail = "อีเวนต์นี้เปิดให้เฉพาะผู้ได้รับเชิญ";
}

export class EventHasEnrollments extends HTTPError.id("EVENT_HAS_ENROLLMENTS", 409) {
  override readonly detail = "อีเวนต์นี้มีผู้ลงทะเบียนแล้ว จึงลบไม่ได้";
}

export class SlugTaken extends HTTPError.id("SLUG_TAKEN", 409) {
  override readonly detail = "ลิงก์นี้ถูกใช้แล้ว";
}

export class InvalidSlug extends HTTPError.id("INVALID_SLUG", 422) {
  override readonly detail = "ลิงก์นี้ใช้ไม่ได้ กรุณาเลือกลิงก์อื่น";
}

export class CategoryNotFound extends HTTPError.id("CATEGORY_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบหมวดหมู่นี้";
}

export class EventSuspended extends HTTPError.id("EVENT_SUSPENDED", 403) {
  override readonly detail = "อีเวนต์นี้ถูกระงับ เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขได้";
}

export class SuspendForbidden extends HTTPError.id("SUSPEND_FORBIDDEN", 403) {
  override readonly detail = "เฉพาะผู้ดูแลระบบเท่านั้นที่ระงับหรือยกเลิกการระงับอีเวนต์ได้";
}

export class InvalidSchedule extends HTTPError.id("INVALID_SCHEDULE", 422) {
  override readonly detail = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น";
}

export class InvalidRefund extends HTTPError.id("INVALID_REFUND", 422) {
  override readonly detail = "กรุณาระบุจำนวนชั่วโมงก่อนเริ่มงานและเปอร์เซ็นต์การคืนเงิน";
}

/** SQLSTATE of a Postgres error; Drizzle wraps the driver error, so the code may sit on `cause`. */
function pgCode(error: unknown) {
  return (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
}

export const isUniqueViolation = (error: unknown) => pgCode(error) === "23505";
/** 23503: a referenced row is missing; 23001: deleting a row an `ON DELETE RESTRICT` key still points at. */
export const isForeignKeyViolation = (error: unknown) => ["23503", "23001"].includes(pgCode(error) ?? "");
