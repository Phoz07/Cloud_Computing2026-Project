/** The browser-facing origin, for links in mail. */
export const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

// mail is read away from the browser, so the time is spelled out in Thailand's zone
const mailTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Bangkok" });
export const formatMailTime = (iso: string) => mailTime.format(new Date(iso));

// "฿1,250" or "฿62.50"
export const baht = (thb: number) =>
  `฿${thb.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(thb) ? 0 : 2, maximumFractionDigits: 2 })}`;
