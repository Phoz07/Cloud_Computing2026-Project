import { Elysia } from "elysia";
import { websocket } from "elysia/websocket";
import { viewer } from "../../plugins/viewer";
import { seatsTopic, startSeatFeed, stopSeatFeed, unwatchSeats, watchSeats } from "./feed";
import * as AvailabilityModel from "./model";
import { getAvailability, seatsAccess } from "./service";

// The event page's ticket list asks this for seats and the viewer's own state; signing in isn't
// required, but whoever can't open the event gets the same answer as GET /api/events/:id.
// The live socket then keeps the seats current; the viewer's own state stays with the GET.
export const availability = new Elysia()
  .use(viewer)
  .use(websocket())
  .onStart(({ server }) => {
    if (server) return startSeatFeed(server);
  })
  .onStop(() => stopSeatFeed())
  .get(
    "/events/:eventId/availability",
    {
      viewer: true,
      params: AvailabilityModel.EventsByEventIdAvailabilityGet.Params,
      response: AvailabilityModel.EventsByEventIdAvailabilityGet.Response,
    },
    ({ params, viewer }) => getAvailability(params.eventId, viewer),
  )
  .ws("/events/:eventId/availability/live", {
    viewer: true,
    params: AvailabilityModel.EventsByEventIdAvailabilityLiveWs.Params,
    response: AvailabilityModel.EventsByEventIdAvailabilityLiveWs.Response,
    // checked once the socket is open rather than on the upgrade, so the close code (4000 + the
    // GET's status) tells the web not to reconnect; a refused upgrade would read as a network error
    async open(ws) {
      const { eventId } = ws.params;
      const denied = await seatsAccess(eventId, ws.viewer);
      if (denied) {
        ws.close(4000 + denied.status, denied.code);
        return;
      }
      const first = await watchSeats(eventId, ws.id);
      // closed while counting, after close() ran
      if (ws.readyState !== WebSocket.OPEN) {
        unwatchSeats(eventId, ws.id);
        return;
      }
      ws.subscribe(seatsTopic(eventId));
      if (first) ws.send(first);
    },
    close(ws) {
      unwatchSeats(ws.params.eventId, ws.id);
    },
  });
