import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

// What the viewer can do with a ticket type right now:
// closed: the event isn't open for enrollment (a draft, scheduled, suspended or ended event the organizer previews)
// invite_only: an invite type, and the viewer isn't invited (or isn't signed in)
// invitation_used: the viewer's invitation already has an enrollment
// limit_reached: the viewer holds the most tickets of this type one account may
export const State = t.Union([
  t.Literal("open"),
  t.Literal("sold_out"),
  t.Literal("limit_reached"),
  t.Literal("invite_only"),
  t.Literal("invitation_used"),
  t.Literal("closed"),
]);
export type State = UnwrapSchema<typeof State>;

export const Availability = t.Object({
  ticketTypeId: t.String(),
  // tickets: confirmed, held while their payment is pending, waiting for the organizer's approval
  confirmed: t.Number(),
  reserved: t.Number(),
  pending: t.Number(),
  // seats left (first_come), null when unlimited
  remaining: t.Union([t.Number(), t.Null()]),
  // the viewer's own active tickets of this type
  mine: t.Number(),
  state: State,
});
export type Availability = UnwrapSchema<typeof Availability>;

export const EventsByEventIdAvailabilityGet = {
  Params: t.Object({ eventId: t.String({ format: "uuid" }) }),
  Response: t.Array(Availability),
};
export type EventsByEventIdAvailabilityGet = UnwrapModels<typeof EventsByEventIdAvailabilityGet>;
