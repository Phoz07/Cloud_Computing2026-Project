import { z } from "zod";
import { SLUG_REGEX, toLocalInput, type EventDetail, type EventStatus } from "@/lib/events";

/** The editor's form state; dates are "YYYY-MM-DDTHH:mm" in local time, numbers are input strings. */
export type EventFormValues = {
  title: string;
  slug: string;
  categoryId: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  venueDescription: string;
  venueUrl: string;
  description: string;
  status: EventStatus;
  schedulePublish: boolean;
  publishAt: string;
  isRefundAvailable: boolean;
  refundCutoffHours: string;
  refundPercent: string;
};

export const toFormValues = (event: EventDetail): EventFormValues => ({
  title: event.title,
  slug: event.slug,
  categoryId: event.category.id,
  startsAt: toLocalInput(event.startsAt),
  endsAt: toLocalInput(event.endsAt),
  venue: event.venue,
  venueDescription: event.venueDescription ?? "",
  venueUrl: event.venueUrl ?? "",
  description: event.description ?? "",
  status: event.status,
  schedulePublish: !!event.publishAt,
  publishAt: toLocalInput(event.publishAt),
  isRefundAvailable: event.isRefundAvailable,
  refundCutoffHours: event.refundCutoffHours?.toString() ?? "",
  refundPercent: event.refundPercent?.toString() ?? "",
});

// mid-edit values may not parse yet; keep them as they are so they still compare
const isoOrRaw = (value: string) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : value;
};

/** The PATCH body these values stand for (every field). */
export function toPayload(values: EventFormValues) {
  return {
    title: values.title.trim(),
    slug: values.slug,
    categoryId: values.categoryId,
    startsAt: isoOrRaw(values.startsAt),
    endsAt: isoOrRaw(values.endsAt),
    venue: values.venue.trim(),
    venueDescription: values.venueDescription.trim() || null,
    venueUrl: values.venueUrl.trim() || null,
    description: values.description || null,
    status: values.status,
    publishAt: values.schedulePublish && values.publishAt ? isoOrRaw(values.publishAt) : null,
    isRefundAvailable: values.isRefundAvailable,
    refundCutoffHours: values.isRefundAvailable ? Number(values.refundCutoffHours) : null,
    refundPercent: values.isRefundAvailable ? Number(values.refundPercent) : null,
  };
}

export type EventPatch = Partial<ReturnType<typeof toPayload>>;

/**
 * Only what changed since `baseline` (the values last loaded or saved). Sending a partial body
 * keeps a save from overwriting fields someone else changed meanwhile.
 */
export function diffPayload(values: EventFormValues, baseline: EventFormValues): EventPatch {
  const next = toPayload(values);
  const before = toPayload(baseline);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) patch[key] = next[key];
  }
  return patch as EventPatch;
}

const hoursPattern = /^\d+$/;

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณากรอกชื่ออีเวนต์").max(150, "ชื่อยาวได้ไม่เกิน 150 ตัวอักษร"),
    slug: z
      .string()
      .refine((v) => v.length >= 3 && v.length <= 80 && SLUG_REGEX.test(v), "ลิงก์ต้องยาว 3–80 ตัวอักษร ใช้ a-z, 0-9 และ -"),
    categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
    startsAt: z.string().min(1, "กรุณาเลือกวันเวลาเริ่ม"),
    endsAt: z.string().min(1, "กรุณาเลือกวันเวลาสิ้นสุด"),
    venue: z.string().trim().min(1, "กรุณากรอกสถานที่").max(200, "ยาวได้ไม่เกิน 200 ตัวอักษร"),
    venueDescription: z.string().trim().max(1000, "ยาวได้ไม่เกิน 1,000 ตัวอักษร"),
    venueUrl: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://"),
    description: z.string().max(100_000, "รายละเอียดยาวเกินไป"),
    status: z.enum(["draft", "public", "invite", "suspended"]),
    schedulePublish: z.boolean(),
    publishAt: z.string(),
    isRefundAvailable: z.boolean(),
    refundCutoffHours: z.string(),
    refundPercent: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น" });
    }
    if (v.status === "public" && v.schedulePublish && !v.publishAt) {
      ctx.addIssue({ code: "custom", path: ["publishAt"], message: "กรุณาเลือกเวลาเผยแพร่" });
    }
    if (!v.isRefundAvailable) return;
    if (!hoursPattern.test(v.refundCutoffHours) || Number(v.refundCutoffHours) > 8760) {
      ctx.addIssue({ code: "custom", path: ["refundCutoffHours"], message: "ระบุจำนวนชั่วโมง 0–8,760" });
    }
    if (!hoursPattern.test(v.refundPercent) || Number(v.refundPercent) > 100) {
      ctx.addIssue({ code: "custom", path: ["refundPercent"], message: "ระบุเปอร์เซ็นต์ 0–100" });
    }
  });

/** Scrolls to and focuses the first invalid control inside `root`, after React has painted the errors. */
export function focusFirstInvalid(root: string) {
  requestAnimationFrame(() => {
    const control = document.querySelector<HTMLElement>(`${root} [aria-invalid="true"]`);
    control?.scrollIntoView({ block: "center", behavior: "smooth" });
    control?.focus({ preventScroll: true });
  });
}
