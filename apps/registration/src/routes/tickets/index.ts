import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import * as TicketModel from "./model";
import { getTicket, listMine } from "./service";

// "My tickets": what the signed-in user bought, and tickets someone else bought for their email.
// `/tickets/mine` is registered before `/tickets/:id`.
export const ticketRoutes = new Elysia()
  .use(authGuard)
  .get("/tickets/mine", { auth: true, response: TicketModel.MineGet.Response }, ({ user }) => listMine(user))
  .get(
    "/tickets/:id",
    { auth: true, params: TicketModel.ByIdGet.Params, response: TicketModel.ByIdGet.Response },
    ({ user, params }) => getTicket(params.id, user),
  );
