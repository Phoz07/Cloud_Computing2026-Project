import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

// What anyone may see about an organizer. Never the email, nor the application's contact or reason:
// those were given to admins, not to the public.
export const Profile = t.Object({
  id: t.String(),
  /** the organization name from their approved application, or their own name */
  name: t.String(),
  image: t.Union([t.String(), t.Null()]),
  /** when they were first approved as an organizer; null for admins who never applied */
  organizerSince: t.Union([t.String(), t.Null()]),
});
export type Profile = UnwrapSchema<typeof Profile>;

export const ByIdGet = {
  Params: t.Object({ id: t.String({ format: "uuid" }) }),
  Response: Profile,
};
export type ByIdGet = UnwrapModels<typeof ByIdGet>;
