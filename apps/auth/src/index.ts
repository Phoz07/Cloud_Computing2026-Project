import { authentication } from "./app";

export { authentication };
export type { Authentication } from "./app";

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3001);
  authentication.listen(port);
  console.log(`Auth service is runing on : http://localhost:${port}`);
}
