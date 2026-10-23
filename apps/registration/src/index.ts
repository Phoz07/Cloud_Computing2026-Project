import { Elysia } from 'elysia'
import { authGuard } from '@app/auth-guard'

export const registration = new Elysia({ prefix: "/api/regis" })
    .use(authGuard)
    .get('/health', () => 'โอเค')

export type Registration = typeof registration;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3003);
  registration.listen(port);
  console.log(`Registration service is runing on : http://localhost:${port}`);
}
