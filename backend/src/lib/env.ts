import path from 'path';
import { config } from 'dotenv';

let loaded = false;

export const loadEnv = () => {
  if (loaded) return;

  const envPath = path.resolve(__dirname, '../../../.env');
  config({ path: envPath });
  loaded = true;
};

export const getEnv = (key: string, defaultValue?: string) => {
  loadEnv();
  const value = process.env[key];
  if (value) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing environment variable: ${key}`);
};

export const getAllowedOrigins = () => {
  const raw = getEnv('ALLOWED_ORIGINS', '');
  if (!raw) {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
};

export const getHeartbeatPollInterval = () => {
  const value = Number(getEnv('HEARTBEAT_POLL_INTERVAL_MS', '60000'));
  return Number.isFinite(value) && value > 0 ? value : 60000;
};
