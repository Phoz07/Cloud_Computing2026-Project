import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });
const Nullable = <T extends ReturnType<typeof t.String> | ReturnType<typeof t.Object>>(schema: T) =>
  t.Union([schema, t.Null()]);

// `awaiting_payment` past its hold reads as `expired`
export const Status = t.Union([
  t.Literal("pending"),
  t.Literal("awaiting_payment"),
  t.Literal("confirmed"),
  t.Literal("rejected"),
  t.Literal("expired"),
  t.Literal("cancelled"),
]);
export type Status = UnwrapSchema<typeof Status>;

export const Kind = t.Union([t.Literal("first_come"), t.Literal("approval"), t.Literal("invite")]);

export const EventSummary = t.Object({
  id: t.String(),
  slug: t.String(),
  title: t.String(),
  venue: t.String(),
  startsAt: t.String(),
  endsAt: t.String(),
  thumbnailUrl: Nullable(t.String()),
});
export type EventSummary = UnwrapSchema<typeof EventSummary>;

export const TicketTypeSummary = t.Object({ id: t.String(), name: t.String(), kind: Kind });

export const Answer = t.Object({ questionId: t.String(), label: t.String(), value: t.String() });

export const Attendee = t.Object({
  id: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  email: t.String(),
  // only once confirmed
  code: Nullable(t.String()),
  answers: t.Array(Answer),
});

export const RefundStatus = t.Union([
  t.Literal("pending"),
  t.Literal("requires_action"),
  t.Literal("succeeded"),
  t.Literal("failed"),
  t.Literal("canceled"),
]);

export const Refund = t.Object({
  id: t.String(),
  // THB
  amount: t.Number(),
  percent: t.Number(),
  status: RefundStatus,
  initiatedBy: t.Union([t.Literal("buyer"), t.Literal("organizer"), t.Literal("system")]),
  createdAt: t.String(),
});

export const Enrollment = t.Object({
  id: t.String(),
  status: Status,
  quantity: t.Number(),
  // THB
  unitPrice: t.Number(),
  total: t.Number(),
  // awaiting_payment: the hold or the payment deadline
  expiresAt: Nullable(t.String()),
  createdAt: t.String(),
  reviewedAt: Nullable(t.String()),
  confirmedAt: Nullable(t.String()),
  cancelledAt: Nullable(t.String()),
  // what the buyer gets back by cancelling, under the policy they ordered with; null = no refunds
  refundTerms: Nullable(t.Object({ percent: t.Number(), amount: t.Number(), deadline: t.String() })),
  // oldest first; a cancelled order has the one that cancelled it
  refunds: t.Array(Refund),
  event: EventSummary,
  ticketType: TicketTypeSummary,
  // null once the buyer deleted their account
  buyer: Nullable(t.Object({ id: t.String(), name: t.String(), email: t.String() })),
  tickets: t.Array(Attendee),
});
export type Enrollment = UnwrapSchema<typeof Enrollment>;

const Name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });

export const AttendeeInput = t.Object({
  firstName: Name,
  lastName: Name,
  // where the ticket is sent; the account with this email sees it too
  email: t.String({ format: "email", maxLength: 254 }),
  answers: t.Array(t.Object({ questionId: Id, value: t.String({ maxLength: 2000 }) }), { maxItems: 30 }),
});
export type AttendeeInput = UnwrapSchema<typeof AttendeeInput>;

export const Post = {
  // one attendee per ticket
  Body: t.Object({ ticketTypeId: Id, attendees: t.Array(AttendeeInput, { minItems: 1, maxItems: 10 }) }),
  Response: Enrollment,
};
export type Post = UnwrapModels<typeof Post>;

export const ByIdGet = { Params: t.Object({ id: Id }), Response: Enrollment };
export type ByIdGet = UnwrapModels<typeof ByIdGet>;

export const ByIdApprovePost = { Params: t.Object({ id: Id }), Response: Enrollment };
export type ByIdApprovePost = UnwrapModels<typeof ByIdApprovePost>;

export const ByIdRejectPost = {
  Params: t.Object({ id: Id }),
  // told to the buyer in the rejection mail
  Body: t.Object({ note: t.Optional(t.String({ maxLength: 500 })) }),
  Response: Enrollment,
};
export type ByIdRejectPost = UnwrapModels<typeof ByIdRejectPost>;

export const StatusCounts = t.Object({
  pending: t.Number(),
  awaiting_payment: t.Number(),
  confirmed: t.Number(),
  rejected: t.Number(),
  expired: t.Number(),
  cancelled: t.Number(),
});

export const EventsByEventIdEnrollmentsGet = {
  Params: t.Object({ eventId: Id }),
  Query: t.Object({
    page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
    pageSize: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 10 })),
    // matches the buyer's or an attendee's name or email
    q: t.Optional(t.String({ maxLength: 100 })),
    status: t.Optional(Status),
    ticketTypeId: t.Optional(Id),
  }),
  // `counts` ignore the status filter, so status tabs can show every count at once
  Response: t.Object({ items: t.Array(Enrollment), total: t.Number(), counts: StatusCounts }),
};
export type EventsByEventIdEnrollmentsGet = UnwrapModels<typeof EventsByEventIdEnrollmentsGet>;
