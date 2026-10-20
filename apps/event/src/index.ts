import { Elysia } from 'elysia'

export const event = new Elysia({ prefix: "/api/events" })
    .get('/health', () => 'โอเค')

export type Event = typeof event;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3002);
  event.listen(port);
  console.log(`Event service is runing on : http://localhost:${port}`);
}
