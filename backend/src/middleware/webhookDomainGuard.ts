import type { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../lib/logger';
import { getAllowedWebhookDomain, getPublicBaseUrl } from '../lib/env';

export type WebhookKind = 'mercadopago';

interface DomainGuardTelemetry {
  lastHost: string | null;
  lastUpdated: string | null;
  lastMatch: boolean | null;
  lastRejected: boolean;
}

const telemetry: Record<WebhookKind, DomainGuardTelemetry> = {
  mercadopago: { lastHost: null, lastUpdated: null, lastMatch: null, lastRejected: false },
};

const normalizeHost = (value?: string | null): string | null => {
  if (!value) return null;
  return value.trim().toLowerCase();
};

const getExpectedHost = (): { origin: string | null; host: string | null } => {
  try {
    const configuredHost = getAllowedWebhookDomain();
    if (configuredHost) {
      return { origin: configuredHost, host: configuredHost };
    }

    const origin = getPublicBaseUrl();
    const { host } = new URL(origin);
    return { origin, host: host.toLowerCase() };
  } catch (error) {
    logger.error({ event: 'webhook.domain_guard.missing_public_base', message: (error as Error).message });
    return { origin: null, host: null };
  }
};

const updateTelemetry = (kind: WebhookKind, updates: Partial<DomainGuardTelemetry>) => {
  telemetry[kind] = { ...telemetry[kind], ...updates };
};

export const getWebhookDomainGuardSnapshot = () => {
  const { origin, host } = getExpectedHost();
  return {
    domainGuardEnabled: Boolean(host),
    expectedDomain: origin,
    warnings: {
      mercadopago: { hostMismatch: telemetry.mercadopago.lastMatch === false },
    },
    receivedHostExample: {
      mercadopago: telemetry.mercadopago.lastHost,
    },
    lastSeenHosts: {
      mercadopago: telemetry.mercadopago.lastHost,
    },
  };
};

const buildDomainGuardHandler = (kind: WebhookKind): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { origin, host: expectedHost } = getExpectedHost();
    const receivedHost = normalizeHost(req.headers.host ?? null);
    const timestamp = new Date().toISOString();

    updateTelemetry(kind, {
      lastHost: receivedHost,
      lastUpdated: timestamp,
    });

    if (!expectedHost || !receivedHost) {
      updateTelemetry(kind, { lastMatch: false, lastRejected: true });
      logger.warn({
        event: 'webhook.domain_guard.missing_host',
        kind,
        expected: expectedHost,
        origin,
        received: receivedHost,
      });
      return res.status(400).json({ success: false, error: 'Invalid webhook domain' });
    }

    if (receivedHost !== expectedHost) {
      updateTelemetry(kind, { lastMatch: false, lastRejected: true });
      logger.warn({
        event: 'webhook.domain_guard.mismatch',
        webhookDomainMismatch: true,
        kind,
        expected: expectedHost,
        origin,
        received: receivedHost,
      });
      return res.status(400).json({ success: false, error: 'Invalid webhook domain' });
    }

    updateTelemetry(kind, { lastMatch: true, lastRejected: false });
    return next();
  };
};

export const webhookDomainGuard = {
  mercadopago: buildDomainGuardHandler('mercadopago'),
};
