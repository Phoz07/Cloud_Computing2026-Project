import { createContext } from "react";

/**
 * Where the mail's images come from: the preview server's `emails/static` folder by default, and
 * the inline attachments the worker sends with the mail (src/render.tsx).
 */
export const MailAssets = createContext({ logo: "/static/logo.png" });
