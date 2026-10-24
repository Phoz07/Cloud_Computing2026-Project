import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Params = t.Object({ ticketTypeId: t.String({ format: "uuid" }) });
const Quantity = t.Integer({ minimum: 1, maximum: 10 });

// The signed-in account's seats of a first_come ticket type, held while it fills in the enroll form
export const Hold = t.Object({
  ticketTypeId: t.String(),
  quantity: t.Number(),
  expiresAt: t.String(),
  // ms left when this was sent; the web counts down from it, since the browser's clock may be off
  expiresIn: t.Number(),
});
export type Hold = UnwrapSchema<typeof Hold>;

// Starts a hold, or answers the account's running one as it is (a reload, another tab or device)
export const TicketTypesByTicketTypeIdHoldPost = {
  Params,
  // seats a new hold starts with (default 1); a running hold keeps its own
  Body: t.Object({ quantity: t.Optional(Quantity) }),
  Response: Hold,
};
export type TicketTypesByTicketTypeIdHoldPost = UnwrapModels<typeof TicketTypesByTicketTypeIdHoldPost>;

// Changes how many seats the running hold has; its deadline stays
export const TicketTypesByTicketTypeIdHoldPatch = {
  Params,
  Body: t.Object({ quantity: Quantity }),
  Response: Hold,
};
export type TicketTypesByTicketTypeIdHoldPatch = UnwrapModels<typeof TicketTypesByTicketTypeIdHoldPatch>;
