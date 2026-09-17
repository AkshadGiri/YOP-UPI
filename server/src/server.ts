import { env } from './config/env';
import { createApp } from './app';
import { logger } from './utils/logger';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
  logger.info(`DEMO_MODE=${env.DEMO_MODE} PAYMENT_MODE=${env.PAYMENT_MODE}`);
});
