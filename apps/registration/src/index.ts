import { registration } from "./app";

export { registration };
export type { Registration } from "./app";

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3003);
  registration.listen(port);
  console.log(`Registration service is runing on : http://localhost:${port}`);
}
