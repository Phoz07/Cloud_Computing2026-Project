import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { eventOwner } from "../../plugins/event-owner";
import * as RefundModel from "./model";
import { listEventRefunds, refundAsBuyer, refundAsOrganizer } from "./service";

// Cancelling a paid order with a refund: its buyer under the order's refund policy, or the event's
// organizer (and admins) in full; plus the event's refund history (eventOwner / enrollmentManager).
export const refundRoutes = new Elysia()
  .use(authGuard)
  .use(eventOwner)
  .post(
    "/refunds",
    { auth: true, body: RefundModel.RefundsPost.Body, response: RefundModel.RefundsPost.Response },
    ({ user, body }) => refundAsBuyer(user.id, body.enrollmentId),
  )
  .post(
    "/enrollments/:id/refund",
    {
      enrollmentManager: true,
      params: RefundModel.EnrollmentsByIdRefundPost.Params,
      body: RefundModel.EnrollmentsByIdRefundPost.Body,
      response: RefundModel.EnrollmentsByIdRefundPost.Response,
    },
    ({ enrollment, user, body }) => refundAsOrganizer(enrollment.id, user.id, body.note),
  )
  .get(
    "/events/:eventId/refunds",
    {
      eventOwner: true,
      params: RefundModel.EventsByEventIdRefundsGet.Params,
      query: RefundModel.EventsByEventIdRefundsGet.Query,
      response: RefundModel.EventsByEventIdRefundsGet.Response,
    },
    ({ event, query }) => listEventRefunds(event.id, query),
  );
