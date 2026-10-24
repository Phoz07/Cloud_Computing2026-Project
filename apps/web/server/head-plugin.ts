import type { Plugin } from "vite";
import { eventServiceSource, injectHead, renderHead, resolveHead, siteHead } from "./head.ts";

type HeadPluginOptions = { origin: string; eventServiceUrl: string };

/**
 * Fills index.html's `<!--head-->` block: per URL on the dev server, and with the site's card in
 * the build (server/index.ts then fills it per URL in production).
 */
export function headPlugin({ origin, eventServiceUrl }: HeadPluginOptions): Plugin {
  const source = eventServiceSource(eventServiceUrl);
  return {
    name: "eventide-head",
    transformIndexHtml: {
      async handler(html, ctx) {
        const head = ctx.server
          ? await resolveHead(new URL(ctx.originalUrl ?? ctx.path, origin).pathname, { origin, source })
          : siteHead(origin);
        return injectHead(html, renderHead(head));
      },
    },
  };
}
