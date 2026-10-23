import { Elysia } from "elysia";
import { eventOwner } from "../../plugins/event-owner";
import * as InvitationModel from "./model";
import { createInvitations, deleteInvitation, listInvitations, updateInvitation } from "./service";

// Who may open an invite-only event. Only its organizer or an admin sees or changes the list (eventOwner).
export const invitations = new Elysia()
  .use(eventOwner)
  .get(
    "/:id/invitations",
    {
      eventOwner: true,
      params: InvitationModel.ByIdInvitationsGet.Params,
      query: InvitationModel.ByIdInvitationsGet.Query,
      response: InvitationModel.ByIdInvitationsGet.Response,
    },
    ({ event, query }) => listInvitations(event.id, query),
  )
  .post(
    "/:id/invitations",
    {
      eventOwner: true,
      params: InvitationModel.ByIdInvitationsPost.Params,
      body: InvitationModel.ByIdInvitationsPost.Body,
      response: InvitationModel.ByIdInvitationsPost.Response,
    },
    ({ event, body }) => createInvitations(event.id, body.emails),
  )
  .patch(
    "/:id/invitations/:invitationId",
    {
      eventOwner: true,
      params: InvitationModel.ByIdInvitationsByInvitationIdPatch.Params,
      body: InvitationModel.ByIdInvitationsByInvitationIdPatch.Body,
      response: InvitationModel.ByIdInvitationsByInvitationIdPatch.Response,
    },
    ({ event, params, body }) => updateInvitation(event.id, params.invitationId, body),
  )
  .delete(
    "/:id/invitations/:invitationId",
    {
      eventOwner: true,
      params: InvitationModel.ByIdInvitationsByInvitationIdDelete.Params,
      response: InvitationModel.ByIdInvitationsByInvitationIdDelete.Response,
    },
    ({ event, params }) => deleteInvitation(event.id, params.invitationId),
  );
