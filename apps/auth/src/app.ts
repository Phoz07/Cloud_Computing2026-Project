import { Elysia, t } from "elysia";
import { auth, googleEnabled } from "./libs/auth";
import { avatar } from "./routes/avatar";
import { organizerApplications } from "./routes/organizer-applications";

// Our own routes are static or dynamic, so they win over the Better Auth wildcard below.
// .mount() would strip the prefix, but Better Auth routes on the full /api/auth/* path,
// so forward the untouched request instead. parse: 'none' leaves the body stream for Better Auth.
export const authentication = new Elysia({ prefix: "/api/auth" })
  .get("/health", () => "โอเค")
  // lets the web show the Google button only when Google login is configured
  .get("/providers", { response: t.Object({ google: t.Boolean() }) }, () => ({
    google: googleEnabled,
  }))
  .use(organizerApplications)
  .use(avatar)
  .all("/*", { parse: "none" }, ({ request }) => auth.handler(request));

export type Authentication = typeof authentication;
