import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import * as HoldModel from "./model";
import { resizeHold, startHold } from "./service";

// The seats a signed-in account holds while it fills in a first_come ticket type's enroll form.
// Nothing releases a hold but its deadline or the enrollment that takes it over.
export const holdRoutes = new Elysia()
  .use(authGuard)
  .post(
    "/ticket-types/:ticketTypeId/hold",
    {
      auth: true,
      params: HoldModel.TicketTypesByTicketTypeIdHoldPost.Params,
      body: HoldModel.TicketTypesByTicketTypeIdHoldPost.Body,
      response: HoldModel.TicketTypesByTicketTypeIdHoldPost.Response,
    },
    ({ user, params, body }) => startHold(params.ticketTypeId, user, body.quantity),
  )
  .patch(
    "/ticket-types/:ticketTypeId/hold",
    {
      auth: true,
      params: HoldModel.TicketTypesByTicketTypeIdHoldPatch.Params,
      body: HoldModel.TicketTypesByTicketTypeIdHoldPatch.Body,
      response: HoldModel.TicketTypesByTicketTypeIdHoldPatch.Response,
    },
    ({ user, params, body }) => resizeHold(params.ticketTypeId, user, body.quantity),
  );
