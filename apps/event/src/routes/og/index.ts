import { Elysia } from "elysia";
import * as OgModel from "./model";
import { renderCategoryImage, renderEventImage, renderSiteImage } from "./service";

const HOUR = 3600;
const DAY = 24 * HOUR;

const jpeg = (bytes: Uint8Array<ArrayBuffer>, maxAge: number) =>
  new Response(bytes, { headers: { "content-type": "image/jpeg", "cache-control": `public, max-age=${maxAge}` } });

// Open Graph images (1200x630) for link previews; apps/web puts their URLs in the page's meta tags.
// Public, and they read events as an anonymous viewer, so a hidden event never shows up in a preview.
// An event's card is cached for a day: an edit changes its `v`, so crawlers fetch a new URL anyway.
export const og = new Elysia({ prefix: "/og" })
  .get("/site", async () => jpeg(await renderSiteImage(), DAY))
  .get(
    "/events/:id",
    { params: OgModel.EventsByIdGet.Params, query: OgModel.EventsByIdGet.Query },
    async ({ params }) => {
      const image = await renderEventImage(params.id);
      return image instanceof Error ? image : jpeg(image, DAY);
    },
  )
  .get("/categories/:slug", { params: OgModel.CategoriesBySlugGet.Params }, async ({ params }) => {
    const image = await renderCategoryImage(params.slug);
    // the count and covers change with every new or past event
    return image instanceof Error ? image : jpeg(image, HOUR);
  });
