import pino from 'pino';
import { loadEnv } from './env';

loadEnv();

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  base: undefined,
});

export default logger;
