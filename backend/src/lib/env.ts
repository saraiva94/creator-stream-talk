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
