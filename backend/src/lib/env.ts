import path from 'path';
import { config } from 'dotenv';

let loaded = false;
let validated = false;

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'MERCADOPAGO_WEBHOOK_URL',
  'MERCADOPAGO_CURRENCY',
  'RESEND_API_KEY',
  'EMAIL_LOCALE',
  'ALLOWED_ORIGINS',
  'HEARTBEAT_POLL_INTERVAL_MS',
];

type PublicBaseSource = 'env' | 'vercel' | 'local';

let publicBaseResolved = false;
let resolvedPublicBaseUrl: string | null = null;
let resolvedPublicBaseSource: PublicBaseSource = 'local';
let canonicalWebhookBase: string | null = null;

type EnvWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

interface EnvWarningFlags {
  mercadopagoWebhookMismatch: boolean;
}

const envWarnings: EnvWarning[] = [];
const envWarningFlags: EnvWarningFlags = {
  mercadopagoWebhookMismatch: false,
};

let envWarningsEvaluated = false;

const normalizeOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(normalized);
    return url.origin;
  } catch (error) {
    return null;
  }
};

const resolvePublicBaseUrl = () => {
  if (publicBaseResolved) return;
  loadEnv();

  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) {
    const normalized = normalizeOrigin(explicit);
    if (!normalized) {
      throw new Error('Invalid PUBLIC_BASE_URL value. Provide a full URL or domain.');
    }
    resolvedPublicBaseUrl = normalized;
    resolvedPublicBaseSource = 'env';
  } else {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      const normalized = normalizeOrigin(vercelUrl);
      if (!normalized) {
        throw new Error('Invalid VERCEL_URL value. Provide a resolvable domain.');
      }
      resolvedPublicBaseUrl = normalized;
      resolvedPublicBaseSource = 'vercel';
    } else {
      const fallbackPort = process.env.BACKEND_PORT || '4000';
      resolvedPublicBaseUrl = `http://localhost:${fallbackPort}`;
      resolvedPublicBaseSource = 'local';
    }
  }

  canonicalWebhookBase = resolvedPublicBaseUrl ? resolvedPublicBaseUrl.replace(/\/$/, '') : null;
  publicBaseResolved = true;
};

export const loadEnv = () => {
  if (loaded) return;

  const envPath = path.resolve(__dirname, '../../../.env');
  config({ path: envPath });
  loaded = true;
};

export const getEnv = (key: string, defaultValue?: string) => {
  loadEnv();
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing environment variable: ${key}`);
};

const validateEnv = () => {
  if (validated) return;
  requiredEnvVars.forEach((key) => {
    if (!process.env[key] || process.env[key] === '') {
      throw new Error(`Missing environment variable: ${key}`);
    }
  });
  validated = true;
};

export const ensureRequiredEnvs = () => {
  loadEnv();
  validateEnv();
};

export const getRequiredEnvVars = () => [...requiredEnvVars];

export const getMissingEnvVars = () => {
  loadEnv();
  return requiredEnvVars.filter((key) => !process.env[key] || process.env[key] === '');
};

export const getPublicBaseUrl = () => {
  resolvePublicBaseUrl();
  if (!resolvedPublicBaseUrl) {
    throw new Error('Unable to resolve PUBLIC_BASE_URL.');
  }
  return resolvedPublicBaseUrl;
};

export const getPublicBaseUrlMetadata = () => {
  resolvePublicBaseUrl();
  return {
    url: resolvedPublicBaseUrl,
    source: resolvedPublicBaseSource,
    canonicalWebhookBase,
  };
};

export const getCanonicalWebhookBase = () => {
  resolvePublicBaseUrl();
  return canonicalWebhookBase;
};

const normalizeWebhookUrl = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    return null;
  }
};

const compareHosts = (primary: string | null, candidate: string | null) => {
  if (!primary || !candidate) return false;
  try {
    return new URL(primary).host === new URL(candidate).host;
  } catch (error) {
    return false;
  }
};

const evaluateEnvWarnings = () => {
  if (envWarningsEvaluated) return;
  resolvePublicBaseUrl();

  const canonicalBase = canonicalWebhookBase;
  const canonicalMercadoPago = canonicalBase ? `${canonicalBase}/payments/webhook` : null;

  const configuredMercadoPago = normalizeWebhookUrl(process.env.MERCADOPAGO_WEBHOOK_URL || null);
  if (canonicalMercadoPago && configuredMercadoPago && canonicalMercadoPago !== configuredMercadoPago) {
    envWarningFlags.mercadopagoWebhookMismatch = true;
    envWarnings.push({
      code: 'mercadopago.webhook_mismatch',
      message: 'MERCADOPAGO_WEBHOOK_URL differs from the canonical webhook URL.',
      details: {
        expected: canonicalMercadoPago,
        configured: configuredMercadoPago,
      },
    });
  }

  envWarningsEvaluated = true;
};

export const getEnvWarnings = () => {
  evaluateEnvWarnings();
  return {
    list: [...envWarnings],
    flags: { ...envWarningFlags },
  };
};

const buildMercadoPagoExpectation = () => {
  resolvePublicBaseUrl();
  evaluateEnvWarnings();

  const canonicalBase = canonicalWebhookBase;
  const canonicalUrl = canonicalBase ? `${canonicalBase}/payments/webhook` : null;
  const configured = normalizeWebhookUrl(process.env.MERCADOPAGO_WEBHOOK_URL || null);

  return {
    canonicalUrl,
    configuredUrl: configured,
    matchesCanonical: Boolean(canonicalUrl && configured && canonicalUrl === configured),
    matchesHost: compareHosts(canonicalUrl, configured),
  };
};

export const getMercadoPagoWebhookExpectation = () => buildMercadoPagoExpectation();

export const getAllowedOrigins = () => {
  const raw = getEnv('ALLOWED_ORIGINS');
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const getHeartbeatPollInterval = () => {
  const raw = getEnv('HEARTBEAT_POLL_INTERVAL_MS');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Invalid HEARTBEAT_POLL_INTERVAL_MS value');
  }
  return parsed;
};

ensureRequiredEnvs();
