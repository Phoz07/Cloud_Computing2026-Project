import { HTTPError } from "elysia";

export class Unauthorized extends HTTPError.id("UNAUTHORIZED", 401) {
  override readonly detail = "กรุณาเข้าสู่ระบบ";
}

export class Forbidden extends HTTPError.id("FORBIDDEN", 403) {
  override readonly detail = "คุณไม่มีสิทธิ์ทำรายการนี้";
}

export class AuthUnavailable extends HTTPError.id("AUTH_UNAVAILABLE", 503) {
  override readonly detail = "ระบบยืนยันตัวตนไม่พร้อมใช้งาน";
}
