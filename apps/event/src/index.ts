import { event } from "./app";

export { event };
export type { Event } from "./app";

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3002);
  event.listen(port);
  console.log(`Event service is runing on : http://localhost:${port}`);
}
