import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { eventOwner } from "../../plugins/event-owner";
import * as EnrollmentModel from "./model";
import { approveEnrollment, enroll, getEnrollment, listEventEnrollments, rejectEnrollment } from "./service";

// Enrolling (any signed-in user), reading one's own enrollment, and the organizer's side: the list
// of an event's enrollments and approving or rejecting the pending ones (eventOwner / enrollmentManager).
export const enrollmentRoutes = new Elysia()
  .use(authGuard)
  .use(eventOwner)
  .post(
    "/enrollments",
    { auth: true, body: EnrollmentModel.Post.Body, response: EnrollmentModel.Post.Response },
    ({ user, body }) => enroll(user, body),
  )
  .get(
    "/enrollments/:id",
    { auth: true, params: EnrollmentModel.ByIdGet.Params, response: EnrollmentModel.ByIdGet.Response },
    ({ user, params }) => getEnrollment(params.id, user),
  )
  .post(
    "/enrollments/:id/approve",
    {
      enrollmentManager: true,
      params: EnrollmentModel.ByIdApprovePost.Params,
      response: EnrollmentModel.ByIdApprovePost.Response,
    },
    ({ enrollment, user }) => approveEnrollment(enrollment.id, user.id),
  )
  .post(
    "/enrollments/:id/reject",
    {
      enrollmentManager: true,
      params: EnrollmentModel.ByIdRejectPost.Params,
      body: EnrollmentModel.ByIdRejectPost.Body,
      response: EnrollmentModel.ByIdRejectPost.Response,
    },
    ({ enrollment, user, body }) => rejectEnrollment(enrollment.id, user.id, body.note),
  )
  .get(
    "/events/:eventId/enrollments",
    {
      eventOwner: true,
      params: EnrollmentModel.EventsByEventIdEnrollmentsGet.Params,
      query: EnrollmentModel.EventsByEventIdEnrollmentsGet.Query,
      response: EnrollmentModel.EventsByEventIdEnrollmentsGet.Response,
    },
    ({ event, query }) => listEventEnrollments(event.id, query),
  );
