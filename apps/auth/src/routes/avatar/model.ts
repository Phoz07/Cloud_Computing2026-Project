import { t, type UnwrapModels } from "elysia";

// Type and size are checked by @app/storage from the bytes, so the schema only asks for a file.
export const Put = {
  Body: t.Object({ file: t.File() }),
  Response: t.Object({ image: t.String() }),
};
export type Put = UnwrapModels<typeof Put>;

export const Delete = {
  Response: t.Object({ image: t.Null() }),
};
export type Delete = UnwrapModels<typeof Delete>;
