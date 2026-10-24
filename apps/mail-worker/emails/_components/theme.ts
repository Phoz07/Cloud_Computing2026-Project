import { pixelBasedPreset, type TailwindConfig } from "react-email";

// The web's theme tokens (apps/web/src/index.css) under the same names, in hex: mail clients
// don't read oklch. Each one is the Tailwind palette color the web's oklch value comes from.
export const theme: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: "#ffffff", // white
        foreground: "#09090b", // zinc-950
        primary: { DEFAULT: "#00786f", foreground: "#f0fdfa" }, // teal-700, teal-50
        muted: { DEFAULT: "#f4f4f5", foreground: "#71717b" }, // zinc-100, zinc-500
        border: "#e4e4e7", // zinc-200
        destructive: "#e7000b", // red-600
      },
      // Mail clients won't load Google Sans, so the Thai system fonts carry the text.
      fontFamily: {
        sans: ['"Google Sans"', '"Noto Sans Thai"', '"Sukhumvit Set"', '"Leelawadee UI"', "Tahoma", "Arial", "sans-serif"],
        mono: ['"Google Sans Code"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
};
