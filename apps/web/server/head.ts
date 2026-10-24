// The <head> each URL is served with: title, description and Open Graph tags, which link
// previews (LINE, Facebook, X, Discord) read from the HTML without running the app.
// Shared by the Vite plugin (dev) and server/index.ts (production), so it avoids Bun-only APIs.
import { treaty } from "@elysia/eden";
import type { Event } from "@app/event";
import { pageTitle, SITE_DESCRIPTION, SITE_NAME } from "../src/lib/site.ts";

export type Head = {
  title: string;
  description: string;
  /** canonical URL; left out for pages that aren't worth indexing */
  url?: string;
  image: string;
  imageAlt: string;
};

export type HeadEvent = {
  id: string;
  slug: string;
  title: string;
  venue: string;
  description: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  updatedAt: string | Date;
};

export type HeadCategory = { slug: string; name: string; upcoming: number };

/** Where the head reads from, as an anonymous viewer: what it finds is what anyone may see. Null when there's none. */
export type HeadSource = {
  event(slug: string, signal: AbortSignal): Promise<HeadEvent | null>;
  category(slug: string, signal: AbortSignal): Promise<HeadCategory | null>;
};

/** Reads from the event service without a cookie, so a draft or invite-only event is never found. */
export function eventServiceSource(eventServiceUrl: string): HeadSource {
  const api = treaty<Event>(eventServiceUrl).api.events;
  return {
    async event(slug, signal) {
      const { data } = await api({ id: slug }).get({ fetch: { signal } });
      return data;
    },
    async category(slug, signal) {
      const { data: categories } = await api.categories.get({ fetch: { signal } });
      const category = categories?.find((c) => c.slug === slug);
      if (!category) return null;
      const { data: upcoming } = await api.get({ query: { categoryId: category.id, pageSize: 1 }, fetch: { signal } });
      return { slug: category.slug, name: category.name, upcoming: upcoming?.total ?? 0 };
    },
  };
}

// The server's time zone is arbitrary; events are in Thailand (same as the event service's OG cards)
const timeZone = "Asia/Bangkok";
const day = new Intl.DateTimeFormat("th-TH", { timeZone, dateStyle: "short" });
const longDate = new Intl.DateTimeFormat("th-TH", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit" });

function formatDateRange(start: string | Date, end: string | Date) {
  const from = new Date(start);
  const to = new Date(end);
  if (day.format(from) === day.format(to)) return `${longDate.format(from)} · ${time.format(from)}–${time.format(to)}`;
  return `${longDate.format(from)} ${time.format(from)} – ${longDate.format(to)} ${time.format(to)}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntity(entity: string, name: string) {
  if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? entity;
  const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
}

/** The text of the (sanitized) description HTML, on one line. */
export function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
}

const words = new Intl.Segmenter("th", { granularity: "word" });
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

function take(text: string, segmenter: Intl.Segmenter, max: number) {
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (out.length + segment.length > max) break;
    out += segment;
  }
  return out;
}

/**
 * At most `max` characters, ending with "…" when cut. It cuts between words (Thai has no spaces,
 * so Intl.Segmenter finds them), or between characters when one word is longer than that; never
 * inside a character, so a Thai vowel or tone mark never ends up on its own.
 */
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = take(text, words, max - 1).trimEnd() || take(text, graphemes, max - 1);
  return `${cut}…`;
}

const DESCRIPTION_LENGTH = 200;

/** The site's own card, for every page that has nothing more specific. */
export function siteHead(origin: string, url?: string): Head {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url,
    image: `${origin}/api/events/og/site`,
    imageAlt: SITE_NAME,
  };
}

function eventHead(origin: string, event: HeadEvent): Head {
  const about = event.description ? plainText(event.description) : "";
  const summary = `${formatDateRange(event.startsAt, event.endsAt)} · ${event.venue}`;
  // the edit time is in the image URL, so a crawler that cached the old card fetches the new one
  const version = new Date(event.updatedAt).getTime().toString(36);
  return {
    title: pageTitle(event.title),
    description: clip(about ? `${summary} — ${about}` : summary, DESCRIPTION_LENGTH),
    url: `${origin}/events/${event.slug}`,
    image: `${origin}/api/events/og/events/${event.id}?v=${version}`,
    imageAlt: event.title,
  };
}

function categoryHead(origin: string, category: HeadCategory): Head {
  return {
    title: pageTitle(category.name),
    description:
      category.upcoming > 0
        ? `อีเวนต์ในหมวด ${category.name} ที่กำลังจะมาถึง ${category.upcoming.toLocaleString("th-TH")} งาน`
        : `อีเวนต์ในหมวด ${category.name} บน ${SITE_NAME}`,
    url: `${origin}/events/categories/${category.slug}`,
    image: `${origin}/api/events/og/categories/${category.slug}`,
    imageAlt: `หมวดหมู่ ${category.name}`,
  };
}

const CATEGORY_PATH = /^\/events\/categories\/([a-z0-9-]{1,60})\/?$/;
// a slug or a uuid; /events/:slug/enroll/... and the rest get the site's card
const EVENT_PATH = /^\/events\/([a-z0-9-]{1,80})\/?$/;
const EXPLORE_PATH = /^\/events\/?$/;

/** Rejects once `signal` aborts, even if `promise` never settles. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  ]);
}

export type HeadOptions = {
  /** the browser-facing origin, since crawlers need absolute URLs */
  origin: string;
  source: HeadSource;
  /** how long the page waits for the source before it settles for the site's card */
  timeoutMs?: number;
};

/** The head for `pathname`. Never throws: a slow or failing source gives the site's card instead. */
export async function resolveHead(pathname: string, { origin, source, timeoutMs = 1500 }: HeadOptions): Promise<Head> {
  const base = origin.replace(/\/+$/, "");
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const category = CATEGORY_PATH.exec(pathname);
    if (category) {
      const found = await abortable(source.category(category[1]!, signal), signal);
      if (found) return categoryHead(base, found);
    } else if (EXPLORE_PATH.test(pathname)) {
      return { ...siteHead(base, `${base}/events`), title: pageTitle("สำรวจอีเวนต์"), description: "ค้นหาอีเวนต์ที่น่าสนใจ แล้วไปร่วมสนุกกัน" };
    } else {
      const event = EVENT_PATH.exec(pathname);
      if (event && event[1] !== "categories") {
        const found = await abortable(source.event(event[1]!, signal), signal);
        if (found) return eventHead(base, found);
      }
    }
  } catch (error) {
    if (signal.aborted) console.warn(`The head of ${pathname} timed out after ${timeoutMs} ms`);
    else console.error(`Couldn't build the head of ${pathname}`, error);
  }
  return siteHead(base, pathname === "/" ? `${base}/` : undefined);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The tags, every value escaped: titles and descriptions are whatever organizers typed. */
export function renderHead(head: Head) {
  const meta = (attribute: "name" | "property", key: string, content: string) =>
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  return [
    `<title>${escapeHtml(head.title)}</title>`,
    meta("name", "description", head.description),
    head.url && `<link rel="canonical" href="${escapeHtml(head.url)}" />`,
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:locale", "th_TH"),
    meta("property", "og:type", "website"),
    meta("property", "og:title", head.title),
    meta("property", "og:description", head.description),
    head.url && meta("property", "og:url", head.url),
    meta("property", "og:image", head.image),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta("property", "og:image:type", "image/jpeg"),
    meta("property", "og:image:alt", head.imageAlt),
    // X reads the og: tags for everything else
    meta("name", "twitter:card", "summary_large_image"),
  ]
    .filter(Boolean)
    .join("\n    ");
}

const HEAD_BLOCK = /<!--head-->[\s\S]*?<!--\/head-->/;

/** Swaps what's between index.html's `<!--head-->` and `<!--/head-->` for `tags`. */
export function injectHead(html: string, tags: string) {
  // a function, so a `$&` someone typed into a title isn't read as a replacement pattern
  return html.replace(HEAD_BLOCK, () => `<!--head-->\n    ${tags}\n    <!--/head-->`);
}
