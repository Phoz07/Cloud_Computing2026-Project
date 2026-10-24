import { Elysia } from "elysia";
import { eventOwner } from "../../plugins/event-owner";
import { viewer } from "../../plugins/viewer";
import { findVisibleEvent } from "../events/service";
import * as TicketTypeModel from "./model";
import { createTicketType, deleteTicketType, listTicketTypes, updateTicketType } from "./service";

// An event's ticket types and their registration forms. Whoever can open the event sees them
// (the event page lists them); only its organizer or an admin changes them (eventOwner).
export const ticketTypeRoutes = new Elysia()
  .use(eventOwner)
  .use(viewer)
  .get(
    "/:id/ticket-types",
    {
      viewer: true,
      params: TicketTypeModel.ByIdTicketTypesGet.Params,
      response: TicketTypeModel.ByIdTicketTypesGet.Response,
    },
    async ({ params, viewer }) => {
      const event = await findVisibleEvent(params.id, viewer);
      return event instanceof Error ? event : listTicketTypes(event.id);
    },
  )
  .post(
    "/:id/ticket-types",
    {
      eventOwner: true,
      params: TicketTypeModel.ByIdTicketTypesPost.Params,
      body: TicketTypeModel.ByIdTicketTypesPost.Body,
      response: TicketTypeModel.ByIdTicketTypesPost.Response,
    },
    ({ event, body }) => createTicketType(event.id, body),
  )
  .patch(
    "/:id/ticket-types/:ticketTypeId",
    {
      eventOwner: true,
      params: TicketTypeModel.ByIdTicketTypesByTicketTypeIdPatch.Params,
      body: TicketTypeModel.ByIdTicketTypesByTicketTypeIdPatch.Body,
      response: TicketTypeModel.ByIdTicketTypesByTicketTypeIdPatch.Response,
    },
    ({ event, params, body }) => updateTicketType(event.id, params.ticketTypeId, body),
  )
  .delete(
    "/:id/ticket-types/:ticketTypeId",
    {
      eventOwner: true,
      params: TicketTypeModel.ByIdTicketTypesByTicketTypeIdDelete.Params,
      response: TicketTypeModel.ByIdTicketTypesByTicketTypeIdDelete.Response,
    },
    ({ event, params }) => deleteTicketType(event.id, params.ticketTypeId),
  );
