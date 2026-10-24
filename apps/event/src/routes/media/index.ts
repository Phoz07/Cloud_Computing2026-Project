import { Elysia } from "elysia";
import { eventOwner } from "../../plugins/event-owner";
import * as MediaModel from "./model";
import { addAsset, listAssets, removeAsset, removeCover, setCover } from "./service";

// An event's cover and gallery. Anyone may list the gallery; only the organizer or an admin
// changes it (eventOwner).
export const media = new Elysia()
  .use(eventOwner)
  .put(
    "/:id/cover",
    { eventOwner: true, params: MediaModel.ByIdCoverPut.Params, body: MediaModel.ByIdCoverPut.Body },
    ({ event, body }) => setCover(event.id, body.file),
  )
  .delete(
    "/:id/cover",
    {
      eventOwner: true,
      params: MediaModel.ByIdCoverDelete.Params,
      response: MediaModel.ByIdCoverDelete.Response,
    },
    ({ event }) => removeCover(event.id),
  )
  .get(
    "/:id/assets",
    { params: MediaModel.ByIdAssetsGet.Params, response: MediaModel.ByIdAssetsGet.Response },
    ({ params }) => listAssets(params.id),
  )
  .post(
    "/:id/assets",
    {
      eventOwner: true,
      params: MediaModel.ByIdAssetsPost.Params,
      body: MediaModel.ByIdAssetsPost.Body,
    },
    ({ event, body }) => addAsset(event.id, body.file),
  )
  .delete(
    "/:id/assets/:assetId",
    { eventOwner: true, params: MediaModel.ByIdAssetsByAssetIdDelete.Params },
    ({ event, params }) => removeAsset(event.id, params.assetId),
  );
