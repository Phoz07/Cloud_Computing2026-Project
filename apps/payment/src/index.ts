import { payment } from "./app";

export { payment };
export type { Payment } from "./app";

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3004);
  payment.listen(port);
  console.log(`Payment service is runing on : http://localhost:${port}`);
}
