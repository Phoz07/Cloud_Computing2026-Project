const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

export const formatDateTime = (value: Date | string) => dateTime.format(new Date(value));
export const formatDate = (value: Date | string) => date.format(new Date(value));
