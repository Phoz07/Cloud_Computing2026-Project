import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { eventOwner } from "../../plugins/event-owner";
import { viewer } from "../../plugins/viewer";
import * as EventModel from "./model";
import {
  createEvent, deleteEvent, getEvent, isSlugAvailable, listMine, listPublic, updateEvent,
} from "./service";

// Static paths (`/mine`, `/slug-available`) are registered before `/:id`, which takes a uuid or a slug.
export const eventRoutes = new Elysia()
  .use(authGuard)
  .use(eventOwner)
  .use(viewer)
  .get("/", { query: EventModel.Get.Query, response: EventModel.Get.Response }, ({ query }) =>
    listPublic(query),
  )
  .get(
    "/mine",
    {
      role: ["organizer", "admin"],
      query: EventModel.MineGet.Query,
      response: EventModel.MineGet.Response,
    },
    ({ user, query }) => listMine(user, query),
  )
  .get(
    "/slug-available",
    {
      role: ["organizer", "admin"],
      query: EventModel.SlugAvailableGet.Query,
      response: EventModel.SlugAvailableGet.Response,
    },
    ({ query }) => isSlugAvailable(query.slug, query.excludeId),
  )
  .get(
    "/:id",
    { viewer: true, params: EventModel.ByIdGet.Params, response: EventModel.ByIdGet.Response },
    ({ params, viewer }) => getEvent(params.id, viewer),
  )
  .post(
    "/",
    { permission: { event: ["create"] }, body: EventModel.Post.Body, response: EventModel.Post.Response },
    ({ user, body }) => createEvent(user, body),
  )
  .patch(
    "/:id",
    { eventOwner: true, body: EventModel.ByIdPatch.Body, response: EventModel.ByIdPatch.Response },
    ({ event, user, body }) => updateEvent(event.id, user, body),
  )
  .delete(
    "/:id",
    { eventOwner: true, response: EventModel.ByIdDelete.Response },
    ({ event, user }) => deleteEvent(event.id, user),
  );
