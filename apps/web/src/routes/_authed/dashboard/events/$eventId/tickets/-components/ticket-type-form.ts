import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  MAX_OPTIONS, MAX_QUESTIONS, MIN_PAID_PRICE, type QuestionType, type TicketKind, type TicketType,
} from "@/lib/ticket-types";

/** One question while editing; `key` is stable across reorders (the id, or a fresh one for a new question). */
export type QuestionValues = {
  key: string;
  id?: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options: string[];
};

/** The editor's form state; numbers are input strings. */
export type TicketTypeFormValues = {
  kind: TicketKind;
  name: string;
  description: string;
  price: string;
  quota: string;
  maxPerUser: string;
  questions: QuestionValues[];
};

export const emptyQuestion = (type: QuestionType): QuestionValues => ({
  key: crypto.randomUUID(),
  type,
  label: "",
  required: false,
  options: type === "choice" ? ["", ""] : [],
});

export const toFormValues = (type?: TicketType): TicketTypeFormValues =>
  type
    ? {
        kind: type.kind,
        name: type.name,
        description: type.description ?? "",
        price: String(type.price),
        quota: type.quota?.toString() ?? "",
        maxPerUser: String(type.maxPerUser),
        questions: type.questions.map((q) => ({
          key: q.id,
          id: q.id,
          type: q.type,
          label: q.label,
          required: q.required,
          options: q.options ?? [],
        })),
      }
    : { kind: "first_come", name: "", description: "", price: "0", quota: "100", maxPerUser: "1", questions: [] };

/** The POST body these values stand for. */
export function toPayload(values: TicketTypeFormValues) {
  return {
    kind: values.kind,
    name: values.name.trim(),
    description: values.description.trim() || null,
    price: Number(values.price),
    quota: values.kind === "first_come" ? Number(values.quota) : null,
    maxPerUser: Number(values.maxPerUser),
    questions: values.questions.map((q) => ({
      ...(q.id ? { id: q.id } : {}),
      type: q.type,
      label: q.label.trim(),
      required: q.required,
      options: q.type === "choice" ? q.options.map((option) => option.trim()) : null,
    })),
  };
}

export type TicketTypePayload = ReturnType<typeof toPayload>;

/** Only the top-level fields that changed since `baseline` (the questions count as one). */
export function diffPayload(values: TicketTypeFormValues, baseline: TicketTypeFormValues): Partial<TicketTypePayload> {
  const next = toPayload(values);
  const before = toPayload(baseline);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof TicketTypePayload)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) patch[key] = next[key];
  }
  return patch as Partial<TicketTypePayload>;
}

const wholeNumber = /^\d+$/;

const questionSchema = z
  .object({
    key: z.string(),
    id: z.string().optional(),
    type: z.enum(["short_text", "long_text", "choice"]),
    label: z.string().trim().min(1, "กรุณากรอกคำถาม").max(200, "คำถามยาวได้ไม่เกิน 200 ตัวอักษร"),
    required: z.boolean(),
    options: z.array(z.string()),
  })
  .superRefine((q, ctx) => {
    if (q.type !== "choice") return;
    q.options.forEach((option, index) => {
      if (!option.trim()) ctx.addIssue({ code: "custom", path: ["options", index], message: "กรุณากรอกตัวเลือก" });
      else if (option.trim().length > 100) {
        ctx.addIssue({ code: "custom", path: ["options", index], message: "ยาวได้ไม่เกิน 100 ตัวอักษร" });
      }
    });
    const filled = q.options.map((option) => option.trim()).filter(Boolean);
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "ต้องมีอย่างน้อย 2 ตัวเลือก" });
    if (q.options.length > MAX_OPTIONS) {
      ctx.addIssue({ code: "custom", path: ["options"], message: `มีได้ไม่เกิน ${MAX_OPTIONS} ตัวเลือก` });
    }
    if (new Set(filled).size !== filled.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "ตัวเลือกต้องไม่ซ้ำกัน" });
    }
  });

export const ticketTypeSchema = z
  .object({
    kind: z.enum(["first_come", "approval", "invite"]),
    name: z.string().trim().min(1, "กรุณากรอกชื่อตั๋ว").max(100, "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร"),
    description: z.string().max(2000, "รายละเอียดยาวได้ไม่เกิน 2,000 ตัวอักษร"),
    price: z
      .string()
      .refine((v) => wholeNumber.test(v) && Number(v) <= 1_000_000, "ระบุราคาเป็นจำนวนเต็มบาท ไม่เกิน 1,000,000")
      .refine((v) => Number(v) === 0 || Number(v) >= MIN_PAID_PRICE, `ตั๋วฟรีใส่ 0 ตั๋วที่ขายต้องราคาอย่างน้อย ฿${MIN_PAID_PRICE}`),
    quota: z.string(),
    maxPerUser: z
      .string()
      .refine((v) => wholeNumber.test(v) && Number(v) >= 1 && Number(v) <= 10, "ระบุ 1–10 ใบ"),
    questions: z.array(questionSchema).max(MAX_QUESTIONS, `เพิ่มคำถามได้ไม่เกิน ${MAX_QUESTIONS} ข้อ`),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "first_come") return;
    if (!wholeNumber.test(v.quota) || Number(v.quota) < 1 || Number(v.quota) > 100_000) {
      ctx.addIssue({ code: "custom", path: ["quota"], message: "ระบุจำนวนตั๋ว 1–100,000 ใบ" });
    }
  });

type FormOptions = {
  defaultValues: TicketTypeFormValues;
  onSubmit: (props: { value: TicketTypeFormValues }) => Promise<void>;
  onSubmitInvalid: () => void;
};

/** The editor's TanStack form; a hook of its own so the question cards can take it typed. */
export function useTicketTypeForm({ defaultValues, onSubmit, onSubmitInvalid }: FormOptions) {
  return useForm({
    defaultValues,
    validators: { onSubmit: ticketTypeSchema },
    listeners: {
      // a server error (e.g. quota below the seats taken) sticks to its field until that field changes
      onChange: ({ formApi, fieldApi }) => {
        const { errorMap } = fieldApi.state.meta;
        if (errorMap.onServer) fieldApi.setErrorMap({ ...errorMap, onServer: undefined });
        // editing one option leaves the list's own submit error (e.g. duplicates) stale; the next save re-checks it
        const options = /^(questions\[\d+\]\.options)\[\d+\]$/.exec(fieldApi.name)?.[1] as `questions[${number}].options` | undefined;
        if (options && formApi.getFieldMeta(options)?.errorMap.onSubmit) {
          formApi.setFieldMeta(options, (meta) => ({ ...meta, errorMap: { ...meta.errorMap, onSubmit: undefined } }));
        }
      },
    },
    onSubmitInvalid,
    onSubmit,
  });
}

export type TicketTypeForm = ReturnType<typeof useTicketTypeForm>;
