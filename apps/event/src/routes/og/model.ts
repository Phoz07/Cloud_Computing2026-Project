import { t, type UnwrapModels } from "elysia";

export const EventsByIdGet = {
  // a uuid or a slug
  Params: t.Object({ id: t.String({ minLength: 1, maxLength: 80 }) }),
  // ignored: the web puts the event's updatedAt here, so an edit gives crawlers a new URL to fetch
  Query: t.Object({ v: t.Optional(t.String({ maxLength: 32 })) }),
};
export type EventsByIdGet = UnwrapModels<typeof EventsByIdGet>;

export const CategoriesBySlugGet = {
  Params: t.Object({ slug: t.String({ minLength: 1, maxLength: 60 }) }),
};
export type CategoriesBySlugGet = UnwrapModels<typeof CategoriesBySlugGet>;
