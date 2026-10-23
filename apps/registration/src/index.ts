import { Elysia } from 'elysia'

export const registration = new Elysia({ prefix: "/api/regis" })
    .get('/health', () => 'โอเค')

export type Registration = typeof registration;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3003);
  registration.listen(port);
  console.log(`Registration service is runing on : http://localhost:${port}`);
}
