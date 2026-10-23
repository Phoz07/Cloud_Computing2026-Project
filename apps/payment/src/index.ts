import { Elysia } from 'elysia'
import { authGuard } from '@app/auth-guard'

export const payment = new Elysia({ prefix: "/api/payment" })
    .use(authGuard)
    .get('/health', () => 'โอเค')

export type Payment = typeof payment;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3004);
  payment.listen(port);
  console.log(`Payment service is runing on : http://localhost:${port}`);
}
