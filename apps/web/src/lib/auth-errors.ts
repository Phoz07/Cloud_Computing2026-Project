// Better Auth error codes (API responses) and OAuth redirect codes (`?error=` on /login) in Thai.
const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  INVALID_EMAIL: "รูปแบบอีเมลไม่ถูกต้อง",
  INVALID_PASSWORD: "รหัสผ่านไม่ถูกต้อง",
  USER_ALREADY_EXISTS: "อีเมลนี้ถูกใช้สมัครแล้ว",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "อีเมลนี้ถูกใช้สมัครแล้ว กรุณาใช้อีเมลอื่น",
  PASSWORD_TOO_SHORT: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  PASSWORD_TOO_LONG: "รหัสผ่านยาวเกินไป",
  BANNED_USER: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
  INVALID_TOKEN: "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่",
  TOKEN_EXPIRED: "ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่",
  SESSION_EXPIRED: "กรุณาเข้าสู่ระบบอีกครั้งก่อนทำรายการนี้",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "ยกเลิกการเชื่อมต่อไม่ได้ เพราะเป็นช่องทางเข้าสู่ระบบสุดท้ายของบัญชี",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "บัญชี Google นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว",
  LINKED_ACCOUNT_ALREADY_EXISTS: "บัญชี Google นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว",
  YOU_CANNOT_BAN_YOURSELF: "คุณระงับบัญชีของตัวเองไม่ได้",
  ORGANIZER_HAS_EVENTS: "ลบบัญชีไม่ได้ เพราะยังมีอีเวนต์ที่บัญชีนี้เป็นผู้จัด",
  account_not_linked:
    "อีเมลนี้สมัครด้วยรหัสผ่านไว้แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน แล้วเชื่อมต่อ Google จากหน้าโปรไฟล์",
  account_already_linked_to_different_user: "บัญชี Google นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว",
  email_does_not_match: "อีเมลของบัญชี Google ไม่ตรงกับอีเมลของคุณ",
  access_denied: "คุณยกเลิกการเข้าสู่ระบบด้วย Google",
};

const fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

/** Accepts a code string or anything with a `code` (Better Auth client errors, thrown mutation errors). */
export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
  return (code && messages[code]) || fallback;
}

/** Message of an Eden error: our services return problem documents with a Thai `detail`. */
export function problemMessage(error: unknown) {
  const value = error && typeof error === "object" && "value" in error ? error.value : undefined;
  if (value && typeof value === "object" && "detail" in value && typeof value.detail === "string") {
    return value.detail;
  }
  return fallback;
}
