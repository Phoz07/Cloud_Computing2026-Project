import { and, asc, count, db, eq, events, inArray, notInArray, ticketTypeQuestions, ticketTypes } from "@app/db";
import { announceSeats, seatsTaken, type Tx } from "@app/tickets";
import { HTTPError } from "elysia";
import { isForeignKeyViolation } from "../../libs/errors";
import * as TicketTypeModel from "./model";

/** Stripe can't charge less than about $0.50, which ฿20 clears even after conversion. */
export const MIN_PAID_PRICE = 20;

export class TicketTypeNotFound extends HTTPError.id("TICKET_TYPE_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบประเภทตั๋วนี้";
}

export class TicketTypeInUse extends HTTPError.id("TICKET_TYPE_IN_USE", 409) {
  override readonly detail = "ประเภทตั๋วนี้มีผู้ลงทะเบียนแล้ว จึงลบไม่ได้";
}

export class KindLocked extends HTTPError.id("KIND_LOCKED", 409) {
  override readonly detail = "เปลี่ยนรูปแบบตั๋วไม่ได้ เพราะมีผู้ลงทะเบียนแล้ว";
}

export class QuotaBelowTaken extends HTTPError.id("QUOTA_BELOW_TAKEN", 409) {
  override readonly detail = "จำนวนตั๋วต้องไม่น้อยกว่าจำนวนที่มีผู้จองไว้แล้ว";
}

export class InvalidPrice extends HTTPError.id("INVALID_PRICE", 422) {
  override readonly detail = `ราคาต้องเป็น 0 (ฟรี) หรืออย่างน้อย ฿${MIN_PAID_PRICE}`;
}

export class InvalidQuota extends HTTPError.id("INVALID_QUOTA", 422) {
  override readonly detail = "กรุณาระบุจำนวนตั๋วสำหรับตั๋วแบบมาก่อนได้ก่อน";
}

export class InvalidQuestion extends HTTPError.id("INVALID_QUESTION", 422) {
  override readonly detail = "คำถามแบบตัวเลือกต้องมีอย่างน้อย 2 ตัวเลือก และตัวเลือกต้องไม่ซ้ำกัน";
}

export class TicketTypeLimitReached extends HTTPError.id("TICKET_TYPE_LIMIT_REACHED", 409) {
  override readonly detail = `สร้างประเภทตั๋วได้สูงสุด ${TicketTypeModel.MAX_TICKET_TYPES_PER_EVENT} ประเภทต่ออีเวนต์`;
}

type TicketTypeRow = typeof ticketTypes.$inferSelect;
type QuestionRow = typeof ticketTypeQuestions.$inferSelect;

const toQuestion = (row: QuestionRow): TicketTypeModel.Question => ({
  id: row.id,
  type: row.type,
  label: row.label,
  required: row.required,
  options: row.options,
});

const toTicketType = (row: TicketTypeRow, questions: QuestionRow[]): TicketTypeModel.TicketType => ({
  id: row.id,
  eventId: row.eventId,
  kind: row.kind,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  quota: row.quota,
  maxPerUser: row.maxPerUser,
  questions: questions.filter((q) => q.ticketTypeId === row.id).map(toQuestion),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Trimmed text, or null when nothing is left; undefined passes through (field not sent). */
const optionalText = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/** The rows a question list stands for, or InvalidQuestion. Options mean nothing outside a choice. */
function normalizeQuestions(questions: TicketTypeModel.QuestionInput[]) {
  const rows = [];
  for (const [position, question] of questions.entries()) {
    let options: string[] | null = null;
    if (question.type === "choice") {
      options = (question.options ?? []).map((option) => option.trim());
      if (options.length < 2 || new Set(options).size !== options.length) return new InvalidQuestion();
    }
    rows.push({ id: question.id, type: question.type, label: question.label.trim(), required: question.required, options, position });
  }
  return rows;
}

const validPrice = (price: number) => price === 0 || price >= MIN_PAID_PRICE;

async function questionsOf(ticketTypeIds: string[]) {
  if (ticketTypeIds.length === 0) return [];
  return db
    .select()
    .from(ticketTypeQuestions)
    .where(inArray(ticketTypeQuestions.ticketTypeId, ticketTypeIds))
    .orderBy(asc(ticketTypeQuestions.position));
}

/** An event's ticket types, oldest first, each with its questions in form order. */
export async function listTicketTypes(eventId: string) {
  const rows = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId))
    .orderBy(asc(ticketTypes.createdAt), asc(ticketTypes.id));
  const questions = await questionsOf(rows.map((row) => row.id));
  return rows.map((row) => toTicketType(row, questions));
}

async function getTicketType(ticketTypeId: string) {
  const [row] = await db.select().from(ticketTypes).where(eq(ticketTypes.id, ticketTypeId));
  if (!row) return new TicketTypeNotFound();
  return toTicketType(row, await questionsOf([row.id]));
}

/**
 * Replaces a ticket type's questions: kept ids are updated in place (so dashboards can still group
 * answers by question), the others deleted, new ones inserted. An id from elsewhere counts as new.
 * Answers already on tickets are copies, so nothing an attendee answered changes.
 */
async function replaceQuestions(tx: Tx, ticketTypeId: string, rows: Exclude<ReturnType<typeof normalizeQuestions>, Error>) {
  const existing = await tx
    .select({ id: ticketTypeQuestions.id })
    .from(ticketTypeQuestions)
    .where(eq(ticketTypeQuestions.ticketTypeId, ticketTypeId));
  const existingIds = new Set(existing.map((row) => row.id));
  const kept = rows.filter((row) => row.id && existingIds.has(row.id));
  const keptIds = kept.map((row) => row.id!);

  await tx
    .delete(ticketTypeQuestions)
    .where(
      and(
        eq(ticketTypeQuestions.ticketTypeId, ticketTypeId),
        keptIds.length ? notInArray(ticketTypeQuestions.id, keptIds) : undefined,
      ),
    );
  for (const { id, ...values } of kept) {
    await tx.update(ticketTypeQuestions).set(values).where(eq(ticketTypeQuestions.id, id!));
  }
  const added = rows.filter((row) => !row.id || !existingIds.has(row.id));
  if (added.length) {
    await tx.insert(ticketTypeQuestions).values(added.map(({ id: _, ...values }) => ({ ...values, ticketTypeId })));
  }
}

export async function createTicketType(eventId: string, input: TicketTypeModel.ByIdTicketTypesPost["Body"]) {
  if (!validPrice(input.price)) return new InvalidPrice();
  const quota = input.kind === "first_come" ? (input.quota ?? null) : null;
  if (input.kind === "first_come" && quota === null) return new InvalidQuota();
  const questions = normalizeQuestions(input.questions);
  if (questions instanceof Error) return questions;

  const created = await db.transaction(async (tx) => {
    // locks the event, so concurrent creates can't overshoot the limit together
    await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for("update");
    const [existing] = await tx.select({ total: count() }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId));
    if ((existing?.total ?? 0) >= TicketTypeModel.MAX_TICKET_TYPES_PER_EVENT) return new TicketTypeLimitReached();

    const [row] = await tx
      .insert(ticketTypes)
      .values({
        eventId,
        kind: input.kind,
        name: input.name.trim(),
        description: optionalText(input.description) ?? null,
        price: input.price.toFixed(2),
        quota,
        maxPerUser: input.maxPerUser,
      })
      .returning({ id: ticketTypes.id });
    await replaceQuestions(tx, row!.id, questions);
    return row!;
  });
  if (created instanceof Error) return created;
  // the event page's live seat feed lists every type of the event
  announceSeats(eventId);
  return getTicketType(created.id);
}

/**
 * Applies a partial update under a lock on the ticket type row, the lock enrolling takes before
 * counting seats, so the kind and quota checks hold against concurrent enrollments.
 */
export async function updateTicketType(
  eventId: string,
  ticketTypeId: string,
  input: TicketTypeModel.ByIdTicketTypesByTicketTypeIdPatch["Body"],
) {
  if (input.price !== undefined && !validPrice(input.price)) return new InvalidPrice();
  const questions = input.questions === undefined ? undefined : normalizeQuestions(input.questions);
  if (questions instanceof Error) return questions;

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(ticketTypes)
      .where(and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.eventId, eventId)))
      .for("update");
    if (!current) return new TicketTypeNotFound();

    const kind = input.kind ?? current.kind;
    const quota = kind !== "first_come" ? null : input.quota !== undefined ? input.quota : current.quota;
    if (kind === "first_come" && quota === null) return new InvalidQuota();
    if (kind !== current.kind || quota !== current.quota) {
      const taken = await seatsTaken(tx, ticketTypeId);
      if (kind !== current.kind && taken > 0) return new KindLocked();
      if (quota !== null && quota < taken) return new QuotaBelowTaken();
    }

    await tx
      .update(ticketTypes)
      .set({
        kind,
        quota,
        name: input.name?.trim(),
        description: optionalText(input.description),
        price: input.price?.toFixed(2),
        maxPerUser: input.maxPerUser,
      })
      .where(eq(ticketTypes.id, ticketTypeId));
    if (questions) await replaceQuestions(tx, ticketTypeId, questions);
    return null;
  });
  if (result) return result;
  announceSeats(eventId);
  return getTicketType(ticketTypeId);
}

/** Deletes a ticket type nobody has enrolled in (enrollments keep it with ON DELETE RESTRICT). */
export async function deleteTicketType(eventId: string, ticketTypeId: string) {
  try {
    const [deleted] = await db
      .delete(ticketTypes)
      .where(and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.eventId, eventId)))
      .returning({ id: ticketTypes.id });
    if (!deleted) return new TicketTypeNotFound();
    announceSeats(eventId);
    return deleted;
  } catch (error) {
    if (isForeignKeyViolation(error)) return new TicketTypeInUse();
    throw error;
  }
}
