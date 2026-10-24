import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });
const Email = t.String({ format: "email", maxLength: 254 });
const Nullable = <T extends ReturnType<typeof t.String> | ReturnType<typeof t.Object>>(schema: T) =>
  t.Union([schema, t.Null()]);

// used: the invitee has enrolled with it (set by apps/registration)
export const Status = t.Union([t.Literal("used"), t.Literal("unused")]);
export type Status = UnwrapSchema<typeof Status>;

export const Invitation = t.Object({
  id: t.String(),
  email: t.String(),
  status: Status,
  // when the invitation email was queued; null until the event is invite-only
  notifiedAt: Nullable(t.String()),
  usedAt: Nullable(t.String()),
  createdAt: t.String(),
  // the account registered with this email, or null while the invitee has none
  user: Nullable(t.Object({ id: t.String(), name: t.String(), image: Nullable(t.String()) })),
});
export type Invitation = UnwrapSchema<typeof Invitation>;

export const ByIdInvitationsGet = {
  Params: t.Object({ id: Id }),
  Query: t.Object({
    page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
    pageSize: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 10 })),
    // matches the email or the invitee's account name
    q: t.Optional(t.String({ maxLength: 100 })),
    status: t.Optional(Status),
  }),
  // `counts` ignore the status filter, so status tabs can show every count at once
  Response: t.Object({
    items: t.Array(Invitation),
    total: t.Number(),
    counts: t.Object({ used: t.Number(), unused: t.Number() }),
  }),
};
export type ByIdInvitationsGet = UnwrapModels<typeof ByIdInvitationsGet>;

export const ByIdInvitationsPost = {
  Params: t.Object({ id: Id }),
  Body: t.Object({ emails: t.Array(Email, { minItems: 1, maxItems: 100 }) }),
  // `skipped`: emails that were already invited
  Response: t.Object({ invited: t.Array(Invitation), skipped: t.Array(t.String()) }),
};
export type ByIdInvitationsPost = UnwrapModels<typeof ByIdInvitationsPost>;

export const ByIdInvitationsByInvitationIdPatch = {
  Params: t.Object({ id: Id, invitationId: Id }),
  Body: t.Object({ email: Email }),
  Response: Invitation,
};
export type ByIdInvitationsByInvitationIdPatch = UnwrapModels<typeof ByIdInvitationsByInvitationIdPatch>;

export const ByIdInvitationsByInvitationIdDelete = {
  Params: t.Object({ id: Id, invitationId: Id }),
  Response: t.Object({ id: t.String() }),
};
export type ByIdInvitationsByInvitationIdDelete = UnwrapModels<typeof ByIdInvitationsByInvitationIdDelete>;
