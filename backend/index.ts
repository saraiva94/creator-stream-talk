import express from 'express';
import cors, { type CorsOptions } from 'cors';
import routes from './src/routes';
import { loadEnv, getEnv, getAllowedOrigins } from './src/lib/env';
import { requestLogger } from './src/middleware/requestLogger';
import { errorHandler } from './src/middleware/errorHandler';
import logger from './src/lib/logger';

loadEnv();

const app = express();
const port = Number(getEnv('BACKEND_PORT', '4000'));
const allowedOrigins = getAllowedOrigins();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn({ event: 'cors.blocked', origin });
    return callback(null, false);
  },
  credentials: true,
};

const corsMiddleware = cors(corsOptions);

app.use(corsMiddleware);
app.options('*', corsMiddleware);
app.use(express.json());
app.use(requestLogger);
app.use('/', routes);
app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on port ${port}`);
});
