import { HTTPError } from "elysia";

// Same codes as apps/event and apps/registration, so the web reads them the same way.
export class EventNotFound extends HTTPError.id("EVENT_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบอีเวนต์นี้";
}

export class EventSuspended extends HTTPError.id("EVENT_SUSPENDED", 403) {
  override readonly detail = "อีเวนต์นี้ถูกระงับ เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขได้";
}

/** Stripe refused the refund for good, e.g. the payment is too old to refund. */
export class RefundRejected extends HTTPError.id("REFUND_REJECTED", 422) {
  override readonly detail = "Stripe คืนเงินรายการนี้ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ";
}

export class RefundUnavailable extends HTTPError.id("REFUND_UNAVAILABLE", 503) {
  override readonly detail = "ระบบคืนเงินขัดข้อง กรุณาลองใหม่อีกครั้ง";
}
