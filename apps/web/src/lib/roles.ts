import type { Role } from "@app/auth-guard/permissions";

export const roleLabels: Record<Role, string> = {
  user: "ผู้ใช้",
  organizer: "ผู้จัดงาน",
  admin: "ผู้ดูแลระบบ",
};
