import { t, type UnwrapModels, type UnwrapSchema } from "elysia";

const Id = t.String({ format: "uuid" });

export const Asset = t.Object({
  id: t.String(),
  url: t.String(),
  contentType: t.String(),
  size: t.Number(),
  createdAt: t.String({ format: "date-time" }),
});
export type Asset = UnwrapSchema<typeof Asset>;

// Type and size are checked by @app/storage from the bytes, so the schemas only ask for a file.
export const ByIdCoverPut = {
  Params: t.Object({ id: Id }),
  Body: t.Object({ file: t.File() }),
  Response: t.Object({ coverUrl: t.String() }),
};
export type ByIdCoverPut = UnwrapModels<typeof ByIdCoverPut>;

export const ByIdCoverDelete = {
  Params: t.Object({ id: Id }),
  Response: t.Object({ coverUrl: t.Null() }),
};
export type ByIdCoverDelete = UnwrapModels<typeof ByIdCoverDelete>;

export const ByIdAssetsGet = {
  Params: t.Object({ id: Id }),
  Response: t.Array(Asset),
};
export type ByIdAssetsGet = UnwrapModels<typeof ByIdAssetsGet>;

export const ByIdAssetsPost = {
  Params: t.Object({ id: Id }),
  Body: t.Object({ file: t.File() }),
  Response: Asset,
};
export type ByIdAssetsPost = UnwrapModels<typeof ByIdAssetsPost>;

export const ByIdAssetsByAssetIdDelete = {
  Params: t.Object({ id: Id, assetId: Id }),
  Response: Asset,
};
export type ByIdAssetsByAssetIdDelete = UnwrapModels<typeof ByIdAssetsByAssetIdDelete>;
