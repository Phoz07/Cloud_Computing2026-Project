import { ownedKey } from "@app/storage";
import sanitizeHtml from "sanitize-html";

/**
 * Cleans the HTML of the WYSIWYG editor before it is stored (and later rendered with
 * dangerouslySetInnerHTML). Images must be files of this event's own gallery: `ownedKey`
 * matches the exact key shape, so `..` segments or other paths can't sneak through.
 */
export function sanitizeDescription(html: string, eventId: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li",
      "blockquote", "hr", "code", "pre", "a", "img",
    ],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: [] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !ownedKey(frame.attribs.src, "eventAsset", eventId),
  });
}
