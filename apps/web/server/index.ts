// Production server for the built SPA (`bun run build`, then `bun run start`). It serves dist/
// and gives every page the head of its URL (server/head.ts), so link previews see the event.
// /api/*, /files/* and the live-seats WebSocket belong to the reverse proxy in front of it.
import { stat } from "node:fs/promises";
import path from "node:path";
import { eventServiceSource, injectHead, renderHead, resolveHead } from "./head.ts";

const dist = path.resolve(import.meta.dir, "../dist");
const indexPath = path.join(dist, "index.html");
const index = await Bun.file(indexPath).text();

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const source = eventServiceSource(process.env.EVENT_SERVICE_URL ?? "http://localhost:3002");

/** The build's file at `pathname`, if there is one (never outside dist, never index.html itself). */
async function buildFile(pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.resolve(dist, `.${decoded}`);
  if (!file.startsWith(dist + path.sep) || file === indexPath) return null;
  const info = await stat(file).catch(() => null);
  return info?.isFile() ? Bun.file(file) : null;
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const { pathname } = new URL(request.url);
    // the proxy should have sent these elsewhere; answering with the app would hide that
    if (pathname.startsWith("/api/") || pathname.startsWith("/files/")) return new Response("Not Found", { status: 404 });

    const file = await buildFile(pathname);
    if (file) {
      // hashed file names under /assets never change; the rest of public/ may
      const cacheControl = pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600";
      return new Response(file, { headers: { "cache-control": cacheControl } });
    }
    // a missing script or image, not a page
    if (path.extname(pathname)) return new Response("Not Found", { status: 404 });

    const head = await resolveHead(pathname, { origin, source });
    return new Response(injectHead(index, renderHead(head)), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
    });
  },
});

console.log(`Web server is running on : http://localhost:${server.port}`);
