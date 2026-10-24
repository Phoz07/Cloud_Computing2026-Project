import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import * as CategoryModel from "./model";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./service";

// Anyone may list categories; only admins change them (`category` permission).
export const categories = new Elysia({ prefix: "/categories" })
  .use(authGuard)
  .get("/", { response: CategoryModel.Get.Response }, () => listCategories())
  .post(
    "/",
    { permission: { category: ["create"] }, body: CategoryModel.Post.Body, response: CategoryModel.Post.Response },
    ({ body }) => createCategory(body),
  )
  .patch(
    "/:id",
    {
      permission: { category: ["update"] },
      params: CategoryModel.ByIdPatch.Params,
      body: CategoryModel.ByIdPatch.Body,
      response: CategoryModel.ByIdPatch.Response,
    },
    ({ params, body }) => updateCategory(params.id, body),
  )
  .delete(
    "/:id",
    {
      permission: { category: ["delete"] },
      params: CategoryModel.ByIdDelete.Params,
      response: CategoryModel.ByIdDelete.Response,
    },
    ({ params }) => deleteCategory(params.id),
  );
