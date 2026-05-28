// apps/backend/src/instrument.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: 'https://48d63b0111d9b8c03beb8eec62d0f8aa@o4511417731055616.ingest.us.sentry.io/4511421434757120',

  tracesSampleRate: 1.0,
});
