import { Elysia } from "elysia";
import { viewer } from "../../plugins/viewer";
import * as AvailabilityModel from "./model";
import { getAvailability } from "./service";

// The event page's ticket list asks this for seats and the viewer's own state; signing in isn't
// required, but whoever can't open the event gets the same answer as GET /api/events/:id.
export const availability = new Elysia().use(viewer).get(
  "/events/:eventId/availability",
  {
    viewer: true,
    params: AvailabilityModel.EventsByEventIdAvailabilityGet.Params,
    response: AvailabilityModel.EventsByEventIdAvailabilityGet.Response,
  },
  ({ params, viewer }) => getAvailability(params.eventId, viewer),
);
