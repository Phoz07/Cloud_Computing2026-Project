import { t, type UnwrapModels, type UnwrapSchema } from "elysia";
import { Answer, Enrollment, EventSummary, TicketTypeSummary } from "../enrollments/model";

// A confirmed ticket, as its buyer or attendee sees it.
export const Ticket = t.Object({
  id: t.String(),
  enrollmentId: t.String(),
  code: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  email: t.String(),
  answers: t.Array(Answer),
  confirmedAt: t.String(),
  event: EventSummary,
  ticketType: TicketTypeSummary,
  // the viewer bought it (maybe for someone else)
  isBuyer: t.Boolean(),
  // who bought it when that wasn't the viewer; null if their account is gone
  boughtBy: t.Union([t.Object({ name: t.String() }), t.Null()]),
});
export type Ticket = UnwrapSchema<typeof Ticket>;

export const MineGet = {
  // orders: the viewer's enrollments still waiting for approval or payment, newest first
  // tickets: confirmed tickets the viewer bought or that carry their email, soonest event first
  Response: t.Object({ orders: t.Array(Enrollment), tickets: t.Array(Ticket) }),
};
export type MineGet = UnwrapModels<typeof MineGet>;

export const ByIdGet = { Params: t.Object({ id: t.String({ format: "uuid" }) }), Response: Ticket };
export type ByIdGet = UnwrapModels<typeof ByIdGet>;
