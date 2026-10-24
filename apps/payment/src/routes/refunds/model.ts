import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });
const NullableString = t.Union([t.String(), t.Null()]);

// Stripe's statuses; requires_action: Stripe asked the buyer where to send the money (e.g. PromptPay)
export const RefundStatus = t.Union([
  t.Literal("pending"),
  t.Literal("requires_action"),
  t.Literal("succeeded"),
  t.Literal("failed"),
  t.Literal("canceled"),
]);
export type RefundStatus = UnwrapSchema<typeof RefundStatus>;

const refundFields = {
  id: t.String(),
  enrollmentId: t.String(),
  // THB
  amount: t.Number(),
  // of what was paid
  percent: t.Number(),
  status: RefundStatus,
  // system: a payment that landed after its hold lapsed, or a second payment for one order
  initiatedBy: t.Union([t.Literal("buyer"), t.Literal("organizer"), t.Literal("system")]),
  createdAt: t.String(),
};

export const Refund = t.Object(refundFields);
export type Refund = UnwrapSchema<typeof Refund>;

export const RefundsPost = {
  // the buyer's own order, refunded under the policy it was made with
  Body: t.Object({ enrollmentId: Id }),
  Response: Refund,
};
export type RefundsPost = UnwrapModels<typeof RefundsPost>;

export const EnrollmentsByIdRefundPost = {
  Params: t.Object({ id: Id }),
  // told to the buyer in the cancellation mail
  Body: t.Object({ note: t.Optional(t.String({ maxLength: 500 })) }),
  Response: Refund,
};
export type EnrollmentsByIdRefundPost = UnwrapModels<typeof EnrollmentsByIdRefundPost>;

export const EventRefund = t.Object({
  ...refundFields,
  // the organizer's message, or the system's reason (duplicate, unavailable)
  note: NullableString,
  // Stripe's, once it failed
  failureReason: NullableString,
  quantity: t.Number(),
  // THB, what the order cost
  orderTotal: t.Number(),
  ticketType: t.Object({
    id: t.String(),
    name: t.String(),
    kind: t.Union([t.Literal("first_come"), t.Literal("approval"), t.Literal("invite")]),
  }),
  // null once the account is deleted
  buyer: t.Union([t.Object({ id: t.String(), name: t.String(), email: t.String() }), t.Null()]),
  // who asked for it; null for the system or a deleted account
  requester: t.Union([t.Object({ name: t.String() }), t.Null()]),
});
export type EventRefund = UnwrapSchema<typeof EventRefund>;

export const StatusCounts = t.Object({
  pending: t.Number(),
  requires_action: t.Number(),
  succeeded: t.Number(),
  failed: t.Number(),
  canceled: t.Number(),
});

export const EventsByEventIdRefundsGet = {
  Params: t.Object({ eventId: Id }),
  Query: t.Object({
    page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
    pageSize: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 10 })),
    status: t.Optional(RefundStatus),
  }),
  // newest first; `counts` and `refundedTotal` (THB, every refund that hasn't failed or been canceled) ignore the status filter
  Response: t.Object({ items: t.Array(EventRefund), total: t.Number(), counts: StatusCounts, refundedTotal: t.Number() }),
};
export type EventsByEventIdRefundsGet = UnwrapModels<typeof EventsByEventIdRefundsGet>;
