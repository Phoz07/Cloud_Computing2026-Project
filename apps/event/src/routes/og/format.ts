// The cards are rendered on the server, whose time zone is arbitrary; events are in Thailand.
const timeZone = "Asia/Bangkok";

const day = new Intl.DateTimeFormat("th-TH", { timeZone, dateStyle: "short" });
const longDate = new Intl.DateTimeFormat("th-TH", {
  timeZone,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const time = new Intl.DateTimeFormat("th-TH", { timeZone, hour: "2-digit", minute: "2-digit" });

/** "ศ. 12 ธ.ค. 2569 · 19:00–22:00", or both full dates when the event spans days (like the web's formatDateRange). */
export function formatDateRange(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  if (day.format(from) === day.format(to)) {
    return `${longDate.format(from)} · ${time.format(from)}–${time.format(to)}`;
  }
  return `${longDate.format(from)} ${time.format(from)} – ${longDate.format(to)} ${time.format(to)}`;
}
