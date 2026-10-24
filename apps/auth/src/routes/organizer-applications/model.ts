import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });

export const Status = t.Union([
  t.Literal("pending"),
  t.Literal("approved"),
  t.Literal("rejected"),
  t.Literal("cancelled"),
]);

export const Application = t.Object({
  id: t.String(),
  organizationName: t.String(),
  contact: t.String(),
  reason: t.String(),
  status: Status,
  reviewNote: t.Nullable(t.String()),
  reviewedAt: t.Nullable(t.String({ format: "date-time" })),
  createdAt: t.String({ format: "date-time" }),
});
export type Application = UnwrapSchema<typeof Application>;

export const ApplicationWithApplicant = t.Object({
  ...Application.properties,
  applicant: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    image: t.Nullable(t.String()),
  }),
});

// wrapped because Elysia sends a bare null as an empty body
export const MeGet = {
  Response: t.Object({ application: t.Nullable(Application) }),
};
export type MeGet = UnwrapModels<typeof MeGet>;

// every application of the signed-in user, newest first
export const MeHistoryGet = {
  Response: t.Array(Application),
};
export type MeHistoryGet = UnwrapModels<typeof MeHistoryGet>;

export const MeDelete = {
  Response: Application,
};
export type MeDelete = UnwrapModels<typeof MeDelete>;

export const Post = {
  Body: t.Object({
    organizationName: t.String({ minLength: 2, maxLength: 120 }),
    contact: t.String({ minLength: 3, maxLength: 200 }),
    reason: t.String({ minLength: 10, maxLength: 2000 }),
  }),
  Response: Application,
};
export type Post = UnwrapModels<typeof Post>;

export const Get = {
  Query: t.Object({ status: t.Optional(Status), userId: t.Optional(Id) }),
  Response: t.Array(ApplicationWithApplicant),
};
export type Get = UnwrapModels<typeof Get>;

export const ByIdApprovePost = {
  Params: t.Object({ id: Id }),
  Response: Application,
};
export type ByIdApprovePost = UnwrapModels<typeof ByIdApprovePost>;

export const ByIdRejectPost = {
  Params: t.Object({ id: Id }),
  Body: t.Object({ note: t.Optional(t.String({ maxLength: 1000 })) }),
  Response: Application,
};
export type ByIdRejectPost = UnwrapModels<typeof ByIdRejectPost>;
