import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });
const Nullable = <T extends ReturnType<typeof t.String> | ReturnType<typeof t.Integer>>(schema: T) =>
  t.Union([schema, t.Null()]);

export const MAX_TICKET_TYPES_PER_EVENT = 20;
export const MAX_QUESTIONS = 30;

// first_come: limited seats; approval: the organizer approves each enrollment; invite: invited emails only
export const Kind = t.Union([t.Literal("first_come"), t.Literal("approval"), t.Literal("invite")]);
export type Kind = UnwrapSchema<typeof Kind>;

export const QuestionType = t.Union([t.Literal("short_text"), t.Literal("long_text"), t.Literal("choice")]);
export type QuestionType = UnwrapSchema<typeof QuestionType>;

// pattern `\S`: at least one non-space character; the service trims the rest
const Name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });
const Description = t.String({ maxLength: 2000 });
// whole baht; 0 = free, a paid price is at least ฿20 (checked by the service: Stripe's minimum charge)
const Price = t.Integer({ minimum: 0, maximum: 1_000_000 });
const Quota = t.Integer({ minimum: 1, maximum: 100_000 });
const MaxPerUser = t.Integer({ minimum: 1, maximum: 10 });
const Label = t.String({ minLength: 1, maxLength: 200, pattern: "\\S" });
const Option = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });

export const QuestionInput = t.Object({
  // an existing question keeps its id (its answers stay linked); a new one has none
  id: t.Optional(Id),
  type: QuestionType,
  label: Label,
  required: t.Boolean(),
  // choice only, 2–20 distinct options; null like the response, so a question can be sent back as read
  options: t.Optional(t.Union([t.Array(Option, { maxItems: 20 }), t.Null()])),
});
export type QuestionInput = UnwrapSchema<typeof QuestionInput>;

// in form order
const Questions = t.Array(QuestionInput, { maxItems: MAX_QUESTIONS });

export const Question = t.Object({
  id: t.String(),
  type: QuestionType,
  label: t.String(),
  required: t.Boolean(),
  options: t.Union([t.Array(t.String()), t.Null()]),
});
export type Question = UnwrapSchema<typeof Question>;

export const TicketType = t.Object({
  id: t.String(),
  eventId: t.String(),
  kind: Kind,
  name: t.String(),
  description: Nullable(t.String()),
  price: t.Number(),
  // first_come only
  quota: Nullable(t.Integer()),
  maxPerUser: t.Number(),
  questions: t.Array(Question),
  createdAt: t.String(),
  updatedAt: t.String(),
});
export type TicketType = UnwrapSchema<typeof TicketType>;

export const ByIdTicketTypesGet = {
  // a uuid or a slug, like GET /:id
  Params: t.Object({ id: t.String({ minLength: 1, maxLength: 80 }) }),
  Response: t.Array(TicketType),
};
export type ByIdTicketTypesGet = UnwrapModels<typeof ByIdTicketTypesGet>;

export const ByIdTicketTypesPost = {
  Params: t.Object({ id: Id }),
  Body: t.Object({
    kind: Kind,
    name: Name,
    description: t.Optional(Nullable(Description)),
    price: Price,
    // required for first_come, ignored for the others
    quota: t.Optional(Nullable(Quota)),
    maxPerUser: MaxPerUser,
    questions: Questions,
  }),
  Response: TicketType,
};
export type ByIdTicketTypesPost = UnwrapModels<typeof ByIdTicketTypesPost>;

export const ByIdTicketTypesByTicketTypeIdPatch = {
  Params: t.Object({ id: Id, ticketTypeId: Id }),
  Body: t.Object({
    kind: t.Optional(Kind),
    name: t.Optional(Name),
    description: t.Optional(Nullable(Description)),
    price: t.Optional(Price),
    quota: t.Optional(Nullable(Quota)),
    maxPerUser: t.Optional(MaxPerUser),
    // replaces the whole list when sent: kept ids are updated, the rest deleted, new ones added
    questions: t.Optional(Questions),
  }),
  Response: TicketType,
};
export type ByIdTicketTypesByTicketTypeIdPatch = UnwrapModels<typeof ByIdTicketTypesByTicketTypeIdPatch>;

export const ByIdTicketTypesByTicketTypeIdDelete = {
  Params: t.Object({ id: Id, ticketTypeId: Id }),
  Response: t.Object({ id: t.String() }),
};
export type ByIdTicketTypesByTicketTypeIdDelete = UnwrapModels<typeof ByIdTicketTypesByTicketTypeIdDelete>;
