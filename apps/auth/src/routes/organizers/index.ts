import { Elysia } from "elysia";
import * as OrganizerModel from "./model";
import { getOrganizerProfile } from "./service";

// Public: the event page shows who organizes it, signed in or not.
export const organizers = new Elysia({ prefix: "/organizers" }).get(
  "/:id",
  { params: OrganizerModel.ByIdGet.Params, response: OrganizerModel.ByIdGet.Response },
  ({ params }) => getOrganizerProfile(params.id),
);
