import { container, image, text } from "takumi-js/helpers";
import type { Node } from "takumi-js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const FONT_FAMILY = "Google Sans";

// Hex versions of the web's theme tokens (apps/web/src/index.css): primary is teal-700,
// foreground zinc-950, muted-foreground zinc-500
const color = {
  primary: "#00786f",
  primaryDark: "#004f4a",
  primarySoft: "#f0fdfa",
  primaryOnDark: "#5eead4",
  foreground: "#09090b",
  muted: "#71717a",
  white: "#ffffff",
};

const PADDING = 64;

/** The navbar's wordmark: "Event" in the primary color, then "ide". */
const wordmark = (size: number, onDark: boolean) =>
  container({
    style: { display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1 },
    children: [
      text("Event", { color: onDark ? color.primaryOnDark : color.primary }),
      text("ide", { color: onDark ? color.white : color.foreground }),
    ],
  });

const root = (style: Record<string, string | number>, children: Node[]) =>
  container({
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      fontFamily: FONT_FAMILY,
      ...style,
    },
    children,
  });

export type EventCardInput = {
  title: string;
  category: string;
  when: string;
  venue: string;
  cover: ArrayBuffer | null;
};

/** The cover fills the card under a dark gradient; without one, a teal gradient. */
export function eventCard({ title, category, when, venue, cover }: EventCardInput) {
  const layers: Node[] = cover
    ? [
        image({
          src: cover,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
        }),
        container({
          style: {
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(180deg, rgb(0 0 0 / 0.35) 0%, rgb(0 0 0 / 0.1) 35%, rgb(0 0 0 / 0.85) 100%)",
          },
        }),
      ]
    : [];

  return root(
    {
      position: "relative",
      justifyContent: "space-between",
      padding: PADDING,
      color: color.white,
      backgroundImage: `linear-gradient(135deg, ${color.primary} 0%, ${color.primaryDark} 100%)`,
    },
    [
      ...layers,
      container({
        // positioned, so it paints above the absolutely positioned cover layers
        style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 },
        children: [
          wordmark(44, true),
          text(category, {
            fontSize: 26,
            fontWeight: 600,
            padding: "10px 24px",
            borderRadius: 999,
            backgroundColor: "rgb(255 255 255 / 0.2)",
            maxWidth: 560,
            lineClamp: 1,
          }),
        ],
      }),
      container({
        style: { position: "relative", display: "flex", flexDirection: "column", gap: 16 },
        children: [
          text(title, { fontSize: 64, fontWeight: 700, lineHeight: 1.3, lineClamp: 2 }),
          text(when, { fontSize: 32, fontWeight: 500, lineHeight: 1.4 }),
          text(venue, { fontSize: 28, lineHeight: 1.4, color: "rgb(255 255 255 / 0.85)", lineClamp: 1 }),
        ],
      }),
    ],
  );
}

export type CategoryCardInput = { name: string; upcoming: number; covers: ArrayBuffer[] };

const COVER_GAP = 24;
const COVER_WIDTH = (OG_WIDTH - PADDING * 2 - COVER_GAP * 2) / 3;

export function categoryCard({ name, upcoming, covers }: CategoryCardInput) {
  const heading = container({
    style: { display: "flex", flexDirection: "column", gap: 8 },
    children: [
      text("หมวดหมู่", { fontSize: 30, fontWeight: 500, color: color.muted }),
      text(name, { fontSize: 76, fontWeight: 700, lineHeight: 1.3, color: color.foreground, lineClamp: 1 }),
      text(upcoming > 0 ? `${upcoming.toLocaleString("th-TH")} อีเวนต์ที่กำลังจะมาถึง` : "ยังไม่มีอีเวนต์ที่กำลังจะมาถึง", {
        fontSize: 32,
        fontWeight: 600,
        color: color.primary,
      }),
    ],
  });

  // without covers, the heading sits in the middle of the space under the wordmark
  const body = covers.length
    ? [
        heading,
        container({
          style: { display: "flex", gap: COVER_GAP },
          children: covers.map((cover) =>
            image({
              src: cover,
              style: { width: COVER_WIDTH, height: (COVER_WIDTH * 9) / 16, objectFit: "cover", borderRadius: 24 },
            }),
          ),
        }),
      ]
    : [container({ style: { display: "flex", flex: 1, alignItems: "center" }, children: [heading] })];

  return root(
    {
      justifyContent: "space-between",
      padding: PADDING,
      backgroundImage: `linear-gradient(160deg, ${color.white} 0%, ${color.primarySoft} 100%)`,
    },
    [wordmark(44, false), ...body],
  );
}

export function siteCard() {
  return root(
    {
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      padding: PADDING,
      color: color.white,
      backgroundImage: `linear-gradient(135deg, ${color.primary} 0%, ${color.primaryDark} 100%)`,
    },
    [
      wordmark(140, true),
      text("ค้นหาอีเวนต์ ลงทะเบียน และรับตั๋วได้ในที่เดียว", {
        fontSize: 40,
        fontWeight: 500,
        color: "rgb(255 255 255 / 0.85)",
      }),
    ],
  );
}
