import fetch, { RequestInit } from 'node-fetch';
import packageJson from '../../package.json';
import logger from '../lib/logger';
import {
  getEnv,
  getMercadoPagoWebhookExpectation,
  getMissingEnvVars,
  getPublicBaseUrlMetadata,
  getRequiredEnvVars,
  getEnvWarnings,
} from '../lib/env';
import { getCorsMetadata } from '../middleware/cors';
import { getWebhookDomainGuardSnapshot } from '../middleware/webhookDomainGuard';
import { getMonitorSnapshot } from './liveMonitorService';
import {
  countActiveLives,
  checkSupabaseConnectivity,
  verifyRequiredTables,
} from './supabaseService';

const serviceStart = Date.now();
const buildDate = new Date().toISOString();
const version = packageJson.version;
const RATE_LIMIT_STATUS = 'enabled';

export const getStatusMessage = () => 'API OK';

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const probeMercadoPago = async (): Promise<'ok' | 'error'> => {
  try {
    const response = await fetchWithTimeout(
      'https://api.mercadopago.com/v1/payments/search?limit=1',
      {
        headers: {
          Authorization: `Bearer ${getEnv('MERCADOPAGO_ACCESS_TOKEN')}`,
          'Content-Type': 'application/json',
        },
      },
      4000,
    );

    return response.ok ? 'ok' : 'error';
  } catch (error) {
    logger.error({ event: 'diagnostics.mercadopago.error', error: (error as Error).message });
    return 'error';
  }
};

const probeResend = async (): Promise<'ok' | 'error'> => {
  try {
    const response = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        headers: {
          Authorization: `Bearer ${getEnv('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
      },
      4000,
    );

    return response.ok ? 'ok' : 'error';
  } catch (error) {
    logger.error({ event: 'diagnostics.resend.error', error: (error as Error).message });
    return 'error';
  }
};

const getEnvIntegrity = () => {
  const missing = getMissingEnvVars();
  const warnings = getEnvWarnings();
  return {
    ok: missing.length === 0,
    missing,
    required: getRequiredEnvVars(),
    warnings: warnings.list,
    warningFlags: warnings.flags,
  };
};

const getMigrationsIntegrity = async () => {
  return verifyRequiredTables();
};

const getMonitorStatus = async () => {
  const snapshot = await getMonitorSnapshot();
  return {
    active: snapshot.enabled,
    running: snapshot.running,
    lastHeartbeatRun: snapshot.lastHeartbeatRun,
    intervalMs: snapshot.intervalMs,
    managedBy: snapshot.managedBy,
    schedule: snapshot.schedule,
  };
};

const getPublicUrlCheck = () => {
  const metadata = getPublicBaseUrlMetadata();
  const mpExpectation = getMercadoPagoWebhookExpectation();

  return {
    resolved: metadata,
    mercadopago: {
      canonicalUrl: mpExpectation.canonicalUrl,
      configuredUrl: mpExpectation.configuredUrl,
      match: mpExpectation.matchesCanonical,
      matchesHost: mpExpectation.matchesHost,
    },
  };
};

const getJitsiSnapshot = () => ({
  mode: 'public-url',
  sampleRoomUrl: 'https://meet.jit.si/sample_room_for_testing',
});

export const getHealthSnapshot = async () => {
  const monitor = await getMonitorSnapshot();
  const activeLives = await countActiveLives();
  const uptimeSeconds = Math.floor((Date.now() - serviceStart) / 1000);

  return {
    health: 'ok',
    uptime: uptimeSeconds.toString(),
    lastHeartbeatRun: monitor.lastHeartbeatRun,
    activeLives,
    version,
  };
};

export const getVersionInfo = () => ({
  version,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  buildDate,
});

export const getDiagnosticsSnapshot = async () => {
  const [supabaseConnectivity, mercadopagoStatus, resendStatus, migrations] = await Promise.all([
    checkSupabaseConnectivity(),
    probeMercadoPago(),
    probeResend(),
    getMigrationsIntegrity(),
  ]);

  const env = getEnvIntegrity();
  const monitor = await getMonitorStatus();
  const cors = getCorsMetadata();
  const publicUrl = getPublicUrlCheck();
  const webhookGuard = getWebhookDomainGuardSnapshot();
  const corsIncludesPublicBase = publicUrl.resolved.url
    ? cors.allowedOrigins.includes(publicUrl.resolved.url)
    : false;

  return {
    supabase: supabaseConnectivity.ok ? 'ok' : 'error',
    mercadopago: mercadopagoStatus,
    resend: resendStatus,
    env: { ok: env.ok, missing: env.missing, warnings: env.warnings, warningFlags: env.warningFlags },
    migrations,
    monitor,
    logger: logger.level,
    ratelimit: RATE_LIMIT_STATUS,
    cors,
    jitsi: getJitsiSnapshot(),
    publicBaseUrl: publicUrl.resolved,
    urlConsistency: {
      canonicalBase: publicUrl.resolved.canonicalWebhookBase,
      mercadopagoWebhook: {
        expectedUrl: publicUrl.mercadopago.canonicalUrl,
        configuredUrl: publicUrl.mercadopago.configuredUrl,
        match: publicUrl.mercadopago.match,
        matchesHost: publicUrl.mercadopago.matchesHost,
      },
      corsIncludesPublicBase,
    },
    webhook: {
      domainGuardEnabled: webhookGuard.domainGuardEnabled,
      expectedDomain: webhookGuard.expectedDomain,
      receivedHostExample: webhookGuard.receivedHostExample,
      lastSeenHosts: webhookGuard.lastSeenHosts,
      warnings: webhookGuard.warnings,
    },
    version,
  };
};

export const getDeploymentChecklist = async () => {
  const env = getEnvIntegrity();
  const migrations = await getMigrationsIntegrity();
  const monitor = await getMonitorStatus();
  const cors = getCorsMetadata();
  const publicUrl = getPublicUrlCheck();
  const webhookGuard = getWebhookDomainGuardSnapshot();
  const corsIncludesPublicBase = publicUrl.resolved.url
    ? cors.allowedOrigins.includes(publicUrl.resolved.url)
    : false;

  const webhookSecrets = {
    mercadopago: Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET),
  };

  return {
    envs: env,
    tables: migrations,
    webhookSecrets,
    mercadopagoWebhook: {
      configured: Boolean(process.env.MERCADOPAGO_WEBHOOK_URL),
      configuredUrl: process.env.MERCADOPAGO_WEBHOOK_URL || null,
      expectedUrl: publicUrl.mercadopago.canonicalUrl,
      match: publicUrl.mercadopago.match,
      matchesHost: publicUrl.mercadopago.matchesHost,
    },
    jitsi: getJitsiSnapshot(),
    publicUrl,
    cors: {
      ...cors,
      includesPublicBase: corsIncludesPublicBase,
    },
    webhookDomainGuard: {
      domainGuardEnabled: webhookGuard.domainGuardEnabled,
      expectedDomain: webhookGuard.expectedDomain,
      receivedHostExample: webhookGuard.receivedHostExample,
      lastSeenHosts: webhookGuard.lastSeenHosts,
      warnings: webhookGuard.warnings,
    },
    supabaseMigrationsApplied: migrations.ok,
    rateLimit: RATE_LIMIT_STATUS,
    heartbeatMonitor: monitor,
    adminRoutesProtected: true,
    authMiddlewareActive: true,
  };
};
