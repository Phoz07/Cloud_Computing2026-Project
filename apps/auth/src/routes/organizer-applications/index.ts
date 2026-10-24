import { Elysia } from "elysia";
import { authGuard } from "../../plugins/auth";
import * as OrganizerApplicationModel from "./model";
import {
  approveApplication,
  cancelApplication,
  createApplication,
  getApplicationHistory,
  getLatestApplication,
  listApplications,
  rejectApplication,
} from "./service";

export const organizerApplications = new Elysia({ prefix: "/organizer-applications" })
  .use(authGuard)
  .get("/me", { auth: true, response: OrganizerApplicationModel.MeGet.Response }, ({ user }) =>
    getLatestApplication(user.id),
  )
  .get("/me/history", { auth: true, response: OrganizerApplicationModel.MeHistoryGet.Response }, ({ user }) =>
    getApplicationHistory(user.id),
  )
  .delete("/me", { role: ["user"], response: OrganizerApplicationModel.MeDelete.Response }, ({ user }) =>
    cancelApplication(user.id),
  )
  // organizers and admins already have the role, so only plain users may apply
  .post("/", { role: ["user"], body: OrganizerApplicationModel.Post.Body }, ({ user, body }) =>
    createApplication(user.id, body),
  )
  .get("/", { role: ["admin"], query: OrganizerApplicationModel.Get.Query }, ({ query }) =>
    listApplications(query),
  )
  .post(
    "/:id/approve",
    { role: ["admin"], params: OrganizerApplicationModel.ByIdApprovePost.Params },
    ({ user, params }) => approveApplication(params.id, user.id),
  )
  .post(
    "/:id/reject",
    {
      role: ["admin"],
      params: OrganizerApplicationModel.ByIdRejectPost.Params,
      body: OrganizerApplicationModel.ByIdRejectPost.Body,
    },
    ({ user, params, body }) => rejectApplication(params.id, user.id, body.note),
  );
