import path from 'path';
import { config } from 'dotenv';
 
let loaded = false;

/**
 * Carrega o .env da raiz do projeto uma única vez
 */
export const loadEnv = () => {
  if (loaded) return;

  // backend/dist/lib/env.js → ../../../.env = raiz do projeto
  const envPath = path.resolve(__dirname, '../../../.env');
  config({ path: envPath });
  loaded = true;
};

/**
 * Lê uma variável de ambiente com fallback opcional
 */
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

/**
 * Origens permitidas pro CORS
 */
export const getAllowedOrigins = () => {
  loadEnv();
  const normalize = (origin: string) => origin.replace(/\/$/, '');
  const origins = new Set<string>();

  const raw = process.env.ALLOWED_ORIGINS ?? '';
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => origins.add(normalize(origin)));

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (frontendUrl) {
    origins.add(normalize(frontendUrl));
  }

  const siteUrl = process.env.VITE_SITE_URL?.trim();
  if (siteUrl) {
    origins.add(normalize(siteUrl));
  }

  if (origins.size === 0) {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:3000');
  }

  return Array.from(origins);
};

/**
 * Intervalo do monitor de heartbeats em ms
 */
export const getHeartbeatPollInterval = () => {
  const value = Number(getEnv('HEARTBEAT_POLL_INTERVAL_MS', '60000'));
  return Number.isFinite(value) && value > 0 ? value : 60000;
};

/**
 * Base URL pública usada em webhooks / links externos
 */
export const getPublicBaseUrl = () => {
  // 1️⃣ Se tiver PUBLIC_BASE_URL no .env, usamos ela
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  // 2️⃣ Se não tiver, tentamos FRONTEND_URL ou outro fallback
  const fallback =
    process.env.FRONTEND_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() || // último recurso
    'http://localhost:4000';

  return fallback.replace(/\/$/, '');
};
