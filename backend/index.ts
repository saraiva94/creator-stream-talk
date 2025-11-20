import express from 'express';
import routes from './src/routes';
import { loadEnv, getEnv } from './src/lib/env';
import { requestLogger } from './src/middleware/requestLogger';
import { errorHandler } from './src/middleware/errorHandler';
import { corsMiddleware } from './src/middleware/cors';
import logger from './src/lib/logger';
import { mercadoPagoWebhookParser } from './src/middleware/rawBodyParsers';

loadEnv();

const app = express();
const port = Number(getEnv('BACKEND_PORT', '4000'));
const enableVerboseLogging = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production';
const isVercel = process.env.VERCEL === '1';
const rawBodyBridgeEnabled = process.env.RAW_BODY === 'true';

app.disable('x-powered-by');

if (rawBodyBridgeEnabled) {
  logger.info({ event: 'rawBody.bridge.enabled', reason: 'vercel_serverless' });
  app.use('/api/payments/webhook', ...mercadoPagoWebhookParser);
}

app.use(corsMiddleware);
if (enableVerboseLogging) {
  app.use(requestLogger);
} else {
  logger.info({ event: 'requestLogger.disabled', reason: 'production_non_debug' });
}

const jsonParser = express.json();
const shouldBypassJsonParsing = (path?: string) => {
  if (!path) {
    return false;
  }
  return path.startsWith('/api/payments/webhook');
};

app.use((req, res, next) => {
  const path = req.path || req.originalUrl;
  if (shouldBypassJsonParsing(path)) {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use('/api', routes);
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = () => {
  server = app.listen(port, () => {
    logger.info({
      event: 'server.listen',
      port,
      mode: 'local_dev',
      modules: {
        auth: true,
        webhookProtection: true,
        rateLimit: true,
        liveStateMachine: true,
        monitor: 'supabase_edge_function',
        diagnostics: true,
        cors: true,
      },
    });
  });
};

if (!isVercel) {
  let shuttingDown = false;

  const gracefulShutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ event: 'server.shutdown.initiated', signal });

    void (async () => {
      if (server) {
        server.close(() => {
          logger.info({ event: 'server.shutdown.complete' });
          process.exit(0);
        });
      } else {
        process.exit(0);
      }

      setTimeout(() => {
        logger.error({ event: 'server.shutdown.timeout' });
        process.exit(1);
      }, 10_000).unref();
    })();
  };

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, () => gracefulShutdown(signal));
  });

  if (require.main === module) {
    logger.info({ event: 'server.mode', mode: 'local_dev', listener: true });
    startServer();
  }
} else {
  logger.info({ event: 'server.mode', mode: 'vercel_serverless', listener: false });
}

process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'process.unhandledRejection', reason });
});

process.on('uncaughtException', (error) => {
  logger.error({ event: 'process.uncaughtException', error: error.message });
});

process.on('exit', (code) => {
  logger.info({ event: 'process.exit', code });
});

export default app;

module.exports = app;
