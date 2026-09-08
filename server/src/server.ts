import 'dotenv/config';
import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[server] DEMO_MODE=${process.env.DEMO_MODE} PAYMENT_MODE=${process.env.PAYMENT_MODE}`);
});
