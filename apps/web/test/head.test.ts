import { describe, expect, test } from "bun:test";
import { clip, injectHead, plainText, renderHead, resolveHead, type HeadEvent, type HeadSource } from "../server/head.ts";

const origin = "https://eventide.test";

const event: HeadEvent = {
  id: "0b6f8a52-7a8e-4b8e-9d3c-2f1e5a6b7c8d",
  slug: "lake-fest",
  title: "เทศกาลดนตรีริมทะเลสาบ",
  venue: "สวนลุมพินี",
  description: "<p>ดนตรีสด &amp; อาหาร</p><p>ทั้งคืน</p>",
  startsAt: "2026-12-12T12:00:00.000Z",
  endsAt: "2026-12-12T15:00:00.000Z",
  updatedAt: "2026-10-20T08:00:00.000Z",
};

/** Knows `events` and `categories` by slug; everything else is missing (or hidden). */
function source(events: HeadEvent[] = [event], categories = [{ slug: "music", name: "ดนตรี", upcoming: 12 }]): HeadSource {
  return {
    event: async (slug) => events.find((e) => e.slug === slug || e.id === slug) ?? null,
    category: async (slug) => categories.find((c) => c.slug === slug) ?? null,
  };
}

const resolve = (pathname: string, from: HeadSource = source()) => resolveHead(pathname, { origin, source: from });

describe("resolveHead", () => {
  test("an event gets its title, summary, canonical URL and versioned card", async () => {
    const head = await resolve("/events/lake-fest");
    expect(head.title).toBe("เทศกาลดนตรีริมทะเลสาบ | Eventide");
    // in Bangkok time; the weekday's abbreviation differs between ICU builds, so it's left out
    expect(head.description).toContain("12 ธ.ค. 2569 · 19:00–22:00 · สวนลุมพินี — ดนตรีสด & อาหาร ทั้งคืน");
    expect(head.url).toBe(`${origin}/events/lake-fest`);
    expect(head.image).toBe(`${origin}/api/events/og/events/${event.id}?v=${Date.parse(event.updatedAt as string).toString(36)}`);
  });

  test("an event opened by uuid points at its slug", async () => {
    expect((await resolve(`/events/${event.id}`)).url).toBe(`${origin}/events/lake-fest`);
  });

  test("a category gets its name, upcoming count and card", async () => {
    const head = await resolve("/events/categories/music");
    expect(head.title).toBe("ดนตรี | Eventide");
    expect(head.description).toBe("อีเวนต์ในหมวด ดนตรี ที่กำลังจะมาถึง 12 งาน");
    expect(head.image).toBe(`${origin}/api/events/og/categories/music`);
  });

  test("missing or hidden events and categories, and other pages, get the site's card", async () => {
    for (const path of ["/events/draft-one", "/events/categories/nope", "/events/categories", "/profile", "/events/lake-fest/enroll/x"]) {
      const head = await resolve(path);
      expect(head.title).toBe("Eventide");
      expect(head.image).toBe(`${origin}/api/events/og/site`);
      expect(head.url).toBeUndefined();
    }
    expect((await resolve("/events")).title).toBe("สำรวจอีเวนต์ | Eventide");
  });

  test("a failing or slow source gives the site's card", async () => {
    const failing: HeadSource = { event: async () => Promise.reject(new Error("down")), category: async () => null };
    expect((await resolve("/events/lake-fest", failing)).title).toBe("Eventide");

    // ignores the signal, so only the timeout can end the wait
    const hanging: HeadSource = { event: () => new Promise(() => {}), category: () => new Promise(() => {}) };
    const started = performance.now();
    const head = await resolveHead("/events/lake-fest", { origin, source: hanging, timeoutMs: 50 });
    expect(head.title).toBe("Eventide");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("renderHead", () => {
  test("escapes what organizers typed", async () => {
    const evil = { ...event, title: `"><script>alert(1)</script>`, description: "<p>a &lt;b&gt; c</p>" };
    const tags = renderHead(await resolve("/events/lake-fest", source([evil])));
    expect(tags).not.toContain("<script>");
    expect(tags).toContain("<title>&#34;&#62;&#60;script&#62;alert(1)&#60;/script&#62; | Eventide</title>");
    expect(tags).toContain('content="&#34;&#62;&#60;script&#62;');
    expect(tags).toContain("a &#60;b&#62; c");
  });

  test("has the Open Graph and Twitter tags", async () => {
    const tags = renderHead(await resolve("/events/lake-fest"));
    for (const tag of ["og:title", "og:description", "og:url", "og:image", "og:image:width", "og:image:alt", "twitter:card"]) {
      expect(tags).toContain(`"${tag}"`);
    }
    expect(tags).toContain('<link rel="canonical" href="https://eventide.test/events/lake-fest" />');
  });
});

describe("injectHead", () => {
  const html = "<head>\n<meta charset=\"UTF-8\" />\n<!--head--><title>Eventide</title><!--/head-->\n</head><body></body>";

  test("replaces only the marked block", () => {
    const out = injectHead(html, "<title>x</title>");
    expect(out).toStartWith('<head>\n<meta charset="UTF-8" />\n<!--head-->');
    expect(out).toContain("<title>x</title>");
    expect(out).not.toContain("<title>Eventide</title>");
    expect(out).toEndWith("<!--/head-->\n</head><body></body>");
  });

  test("keeps replacement patterns literal", () => {
    expect(injectHead(html, "<title>$& $1 $'</title>")).toContain("<title>$& $1 $'</title>");
  });
});

describe("text", () => {
  test("plainText drops tags and decodes entities", () => {
    expect(plainText("<p>A&nbsp;&amp;&#x42;&#67;</p><ul><li>x</li></ul>")).toBe("A &BC x");
    expect(plainText("&#99999999; &bogus;")).toBe("&#99999999; &bogus;");
  });

  test("clip cuts Thai between words, never inside a character", () => {
    const thai = "ดนตรีสดริมทะเลสาบตลอดทั้งคืนพร้อมอาหารอร่อย";
    const cut = clip(thai, 20);
    expect(cut).toEndWith("…");
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(thai.startsWith(cut.slice(0, -1))).toBeTrue();
    // the next character isn't a vowel or tone mark left without its consonant
    expect(thai[cut.length - 1]).not.toMatch(/[ัิ-ฺ็-๎]/);
    expect(clip("สั้น", 20)).toBe("สั้น");
  });

  test("clip falls back to characters for one long word", () => {
    const cut = clip("ก้".repeat(30), 11);
    expect(cut).toBe(`${"ก้".repeat(5)}…`);
  });
});
