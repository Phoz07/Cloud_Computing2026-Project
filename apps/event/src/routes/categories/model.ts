import { t, type UnwrapModels, type UnwrapSchema } from "elysia";
import { SLUG_PATTERN } from "../../libs/slug";

const Id = t.String({ format: "uuid" });
const Name = t.String({ minLength: 1, maxLength: 60, pattern: "\\S" });
const Slug = t.String({ minLength: 2, maxLength: 60, pattern: SLUG_PATTERN });

export const Category = t.Object({ id: t.String(), name: t.String(), slug: t.String() });
export type Category = UnwrapSchema<typeof Category>;

export const Get = { Response: t.Array(Category) };
export type Get = UnwrapModels<typeof Get>;

export const Post = { Body: t.Object({ name: Name, slug: Slug }), Response: Category };
export type Post = UnwrapModels<typeof Post>;

export const ByIdPatch = {
  Params: t.Object({ id: Id }),
  Body: t.Object({ name: t.Optional(Name), slug: t.Optional(Slug) }),
  Response: Category,
};
export type ByIdPatch = UnwrapModels<typeof ByIdPatch>;

export const ByIdDelete = { Params: t.Object({ id: Id }), Response: Category };
export type ByIdDelete = UnwrapModels<typeof ByIdDelete>;
