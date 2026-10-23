import { Elysia } from "elysia";
import { authGuard } from "../../plugins/auth";
import * as AvatarModel from "./model";
import { removeAvatar, setAvatar } from "./service";

export const avatar = new Elysia({ prefix: "/me/avatar" })
  .use(authGuard)
  .put("/", { auth: true, body: AvatarModel.Put.Body }, ({ user, body }) =>
    setAvatar(user.id, body.file),
  )
  .delete("/", { auth: true, response: AvatarModel.Delete.Response }, ({ user }) =>
    removeAvatar(user.id),
  );
