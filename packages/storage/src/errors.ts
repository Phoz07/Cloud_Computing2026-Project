import { HTTPError } from "elysia";

export class UnsupportedFile extends HTTPError.id("UNSUPPORTED_FILE", 415) {
  override readonly detail = "รองรับเฉพาะไฟล์รูป JPEG, PNG หรือ WebP";
}

export class FileTooLarge extends HTTPError.id("FILE_TOO_LARGE", 413) {
  override readonly detail = "ไฟล์มีขนาดใหญ่เกินกำหนด";
}

export class StorageUnavailable extends HTTPError.id("STORAGE_UNAVAILABLE", 503) {
  override readonly detail = "ระบบจัดเก็บไฟล์ไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง";
}
