const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });
const longDate = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (value: Date | string) => dateTime.format(new Date(value));
export const formatDate = (value: Date | string) => date.format(new Date(value));
/** "ศ. 12 ธ.ค. 2569" */
export const formatLongDate = (value: Date | string) => longDate.format(new Date(value));
/** "19:00" */
export const formatTime = (value: Date | string) => time.format(new Date(value));

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "ศ. 12 ธ.ค. 2569 · 19:00–22:00", or both full dates when the event spans days. */
export function formatDateRange(start: Date | string, end: Date | string) {
  const from = new Date(start);
  const to = new Date(end);
  if (sameDay(from, to)) return `${formatLongDate(from)} · ${formatTime(from)}–${formatTime(to)}`;
  return `${formatLongDate(from)} ${formatTime(from)} – ${formatLongDate(to)} ${formatTime(to)}`;
}

const baht = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

/** "฿1,200", or "ฟรี" for 0 */
export const formatPrice = (value: number) => (value === 0 ? "ฟรี" : baht.format(value));

/** "3 ชั่วโมง 30 นาที", "2 วัน 4 ชั่วโมง" */
export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts = [days && `${days} วัน`, hours && `${hours} ชั่วโมง`, rest && `${rest} นาที`].filter(Boolean);
  return parts.length ? parts.join(" ") : "0 นาที";
}
