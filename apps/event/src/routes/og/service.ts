import { db, eq, eventCategories } from "@app/db";
import { ownedKey, readFile } from "@app/storage";
import { render, type Node } from "takumi-js";
import { CategoryNotFound, EventNotFound } from "../../libs/errors";
import { findVisibleEvent, listPublic } from "../events/service";
import { categoryCard, eventCard, FONT_FAMILY, OG_HEIGHT, OG_WIDTH, siteCard } from "./cards";
import { formatDateRange } from "./format";

const FONT_SUBSETS = ["latin", "latin-ext", "thai"];

const fontPath = (subset: string) =>
  Bun.fileURLToPath(
    import.meta.resolve(`@fontsource-variable/google-sans/files/google-sans-${subset}-wght-normal.woff2`),
  );

// Read once: render() decodes the same buffers only once, and picks the subsets a text needs
let fonts: Promise<{ name: string; data: ArrayBuffer }[]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all(
    FONT_SUBSETS.map(async (subset) => ({ name: FONT_FAMILY, data: await Bun.file(fontPath(subset)).arrayBuffer() })),
  ));

async function toJpeg(card: Node) {
  return render(card, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    format: "jpeg",
    quality: 85,
    fonts: await loadFonts(),
    // the default fetches Twemoji over the network; a title's emoji isn't worth that
    emoji: "from-font",
  });
}

/**
 * Renders the card with its images. Takumi already skips one it can't decode; if the render
 * still fails, it gets one more try without them, so a bad upload never costs the preview.
 */
async function withImageFallback(card: (withImages: boolean) => Node) {
  try {
    return await toJpeg(card(true));
  } catch (error) {
    console.error("OG image render failed, retrying without images", error);
    return toJpeg(card(false));
  }
}

/** The bytes of an event's cover, or null when it has none or storage can't read it. */
async function coverOf(event: { id: string; thumbnailUrl: string | null }) {
  const key = ownedKey(event.thumbnailUrl, "eventCover", event.id);
  return key ? readFile(key) : null;
}

// The site card never changes, so it renders once per process
let site: Promise<Uint8Array<ArrayBuffer>> | undefined;
export function renderSiteImage() {
  site ??= toJpeg(siteCard()).catch((error) => {
    site = undefined;
    throw error;
  });
  return site;
}

/** The card of an event anyone may open. Every other event answers like a missing one. */
export async function renderEventImage(idOrSlug: string) {
  const event = await findVisibleEvent(idOrSlug, null);
  // the page answers INVITE_ONLY so an invitee knows to sign in; an image needn't say the event exists
  if (event instanceof Error) return new EventNotFound();
  const cover = await coverOf(event);
  return withImageFallback((withCover) =>
    eventCard({
      title: event.title,
      category: event.category.name,
      when: formatDateRange(event.startsAt, event.endsAt),
      venue: event.venue,
      cover: withCover ? cover : null,
    }),
  );
}

const CATEGORY_COVERS = 3;

/** A category's name, how many public events are coming up, and the covers of the soonest ones. */
export async function renderCategoryImage(slug: string) {
  const [category] = await db
    .select({ id: eventCategories.id, name: eventCategories.name })
    .from(eventCategories)
    .where(eq(eventCategories.slug, slug));
  if (!category) return new CategoryNotFound();

  // a few more than shown, in case some of them have no cover
  const { items, total } = await listPublic({ categoryId: category.id, when: "upcoming", pageSize: CATEGORY_COVERS * 2 });
  const read = await Promise.all(items.filter((event) => event.thumbnailUrl).slice(0, CATEGORY_COVERS).map(coverOf));
  const covers = read.filter((cover) => cover !== null);
  return withImageFallback((withCovers) =>
    categoryCard({ name: category.name, upcoming: total, covers: withCovers ? covers : [] }),
  );
}
