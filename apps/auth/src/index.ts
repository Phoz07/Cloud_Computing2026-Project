import { Elysia } from 'elysia'
import { auth } from './libs/auth'

// .mount() would strip the prefix, but Better Auth routes on the full /api/auth/* path,
// so forward the untouched request instead. parse: 'none' leaves the body stream for Better Auth.
export const authentication = new Elysia({ prefix: "/api/auth" })
    .get('/health', () => 'โอเค')
    .all('/*', { parse: 'none' }, ({ request }) => auth.handler(request))

export type Authentication = typeof authentication;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3001);
  authentication.listen(port);
  console.log(`Auth service is runing on : http://localhost:${port}`);
}
