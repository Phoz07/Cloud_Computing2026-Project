export const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const slugRegex = new RegExp(SLUG_PATTERN);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// `/api/events/<these>` are routes of their own, and a uuid would be read as an event id.
const RESERVED = new Set(["mine", "slug-available", "categories"]);

export const isUsableSlug = (slug: string) =>
  slugRegex.test(slug) && !RESERVED.has(slug) && !uuidRegex.test(slug);

/** Title → ascii slug with a random suffix. Thai-only titles fall back to "event". */
export function slugFromTitle(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "event"}-${crypto.randomUUID().slice(0, 6)}`;
}
