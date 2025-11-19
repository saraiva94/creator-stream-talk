import crypto from 'crypto';
import fetch, { RequestInit } from 'node-fetch';
import logger from '../lib/logger';
import { getEnv } from '../lib/env';
import {
  addCreatorEarnings,
  addParentEarnings,
  getCreatorParent,
  getLiveWithCreator,
  getProfileById,
  grantLiveAccess,
  hasProcessedWebhookEvent,
  markWebhookEventProcessed,
  recordCommissionEntry,
  recordPayment,
  recordPlatformRevenue,
} from './supabaseService';
import { sendTransactionalEmail } from './emailService';
import { generateAccessLink } from './jitsiService';

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

export type PreferenceRequest = {
  liveId: string;
  userId: string;
  price: number;
  paymentId: string;
};

export type PreferenceResponse = {
  init_point: string;
  preferenceId: string;
};

type WebhookPayload = {
  action?: string;
  type?: string;
  data?: {
    id?: string;
  };
  resource?: string;
};

type MercadoPagoPayment = {
  id: string;
  status: string;
  metadata?: Record<string, string>;
  transaction_amount?: number;
};

const getAccessToken = () => getEnv('MERCADOPAGO_ACCESS_TOKEN');
const getWebhookSecret = () => getEnv('MERCADOPAGO_WEBHOOK_SECRET');
const getCurrencyCode = () => process.env.MERCADOPAGO_CURRENCY || 'USD';

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toPayloadString = (payload: WebhookPayload, rawBody?: Buffer | string) => {
  if (typeof rawBody === 'string') {
    return rawBody;
  }
  if (rawBody) {
    return rawBody.toString('utf8');
  }
  return JSON.stringify(payload ?? {});
};

const hashPayload = (payloadString: string) => {
  return crypto.createHash('sha256').update(payloadString).digest('hex');
};

const request = async <T>(endpoint: string, options: RequestInit) => {
  const accessToken = getAccessToken();
  const response = await fetch(`${MERCADOPAGO_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
};

export const createCheckoutPreference = async ({
  liveId,
  userId,
  price,
  paymentId,
}: PreferenceRequest): Promise<PreferenceResponse> => {
  const items = [
    {
      title: 'Live access purchase',
      description: `Access for live ${liveId}`,
      quantity: 1,
      currency_id: getCurrencyCode(),
      unit_price: price,
    },
  ];

  const preferencePayload: Record<string, unknown> = {
    items,
    metadata: {
      liveId,
      userId,
      paymentId,
      amount: price,
    },
    auto_return: 'approved',
    external_reference: paymentId,
  };

  const notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
  if (notificationUrl) {
    preferencePayload.notification_url = notificationUrl;
  }

  const result = await request<{ init_point: string; id: string }>(
    '/checkout/preferences',
    {
      method: 'POST',
      body: JSON.stringify(preferencePayload),
    },
  );

  return { init_point: result.init_point, preferenceId: result.id };
};

const resolvePaymentId = (payload: WebhookPayload): string | undefined => {
  return payload?.data?.id || payload?.resource?.split('/').pop();
};

const fetchPaymentDetails = async (paymentId: string) => {
  return request<MercadoPagoPayment>(`/v1/payments/${paymentId}`, { method: 'GET' });
};

const calculateShares = (
  amount: number,
  creatorPercent: number,
  affiliatePercent: number,
  platformPercent: number,
  hasParentAffiliate: boolean,
) => {
  const normalizedAmount = Number(amount.toFixed(2));
  const creatorShare = Number((normalizedAmount * (creatorPercent / 100)).toFixed(2));
  const parentShare = hasParentAffiliate
    ? Number((normalizedAmount * (affiliatePercent / 100)).toFixed(2))
    : 0;
  const platformShare = Number((normalizedAmount * (platformPercent / 100)).toFixed(2));

  return { creatorShare, parentShare, platformShare };
};

const processRevenueShare = async (paymentId: string, liveId: string, fallbackAmount: number) => {
  const live = await getLiveWithCreator(liveId);

  if (!live) {
    throw new Error('Live not found for revenue processing');
  }

  const parentCreatorId = await getCreatorParent(live.creator_id);
  const basePrice = toNumber(live.price, fallbackAmount);

  if (!basePrice || basePrice <= 0) {
    throw new Error('Unable to resolve live price for revenue processing');
  }

  const creatorPercent = toNumber(live.creator_percent, 60);
  const affiliatePercent = toNumber(live.affiliate_percent, 10);
  const platformPercent = toNumber(live.platform_percent, 30);

  const { creatorShare, parentShare, platformShare } = calculateShares(
    basePrice,
    creatorPercent,
    affiliatePercent,
    platformPercent,
    Boolean(parentCreatorId),
  );

  await addCreatorEarnings(live.creator_id, creatorShare);
  await recordCommissionEntry(live.creator_id, paymentId, creatorShare);

  if (parentCreatorId && parentShare > 0) {
    await addParentEarnings(parentCreatorId, parentShare);
    await recordCommissionEntry(parentCreatorId, paymentId, parentShare);
  }

  await recordPlatformRevenue(paymentId, platformShare);

  return { live, parentCreatorId, creatorShare, parentShare, platformShare, price: basePrice };
};

export const handlePaymentWebhook = async (
  payload: WebhookPayload,
  headers: { signature?: string; requestId?: string; idempotencyKey?: string },
  rawBody?: Buffer | string,
) => {
  const bodyString = toPayloadString(payload, rawBody);
  const bodyHash = hashPayload(bodyString);

  const paymentId = resolvePaymentId(payload);
  if (!paymentId) {
    throw new Error('Missing payment identifier in webhook payload.');
  }

  const idempotencyKey = headers.idempotencyKey || headers.requestId || paymentId;

  if (await hasProcessedWebhookEvent(idempotencyKey, bodyHash)) {
    logger.warn({ event: 'mercadopago.webhook.duplicate', idempotencyKey, paymentId });
    return { processed: false, reason: 'Duplicate webhook' };
  }

  const paymentDetails = await fetchPaymentDetails(paymentId);
  if (paymentDetails.status !== 'approved') {
    const metadata = paymentDetails.metadata || {};
    if (metadata.paymentId && metadata.userId && metadata.liveId) {
      await recordPayment({
        paymentId: metadata.paymentId,
        userId: metadata.userId,
        liveId: metadata.liveId,
        amount: Number(metadata.amount) || paymentDetails.transaction_amount || 0,
        status: paymentDetails.status,
      });
    }
    logger.info({
      event: 'mercadopago.payment.skipped',
      paymentId,
      status: paymentDetails.status,
    });
    await markWebhookEventProcessed(idempotencyKey, bodyHash);
    return { processed: false, reason: 'Payment not approved' };
  }

  const metadata = paymentDetails.metadata || {};
  const liveId = metadata.liveId || metadata.live_id;
  const userId = metadata.userId || metadata.user_id;
  const localPaymentId = metadata.paymentId || metadata.payment_id;
  const amount =
    Number(metadata.amount) || paymentDetails.transaction_amount || Number(metadata.price) || 0;

  if (!liveId || !userId || !localPaymentId) {
    throw new Error('Payment metadata missing liveId, userId, or paymentId.');
  }

  await recordPayment({
    paymentId: localPaymentId,
    userId,
    liveId,
    amount,
    status: 'approved',
  });

  const { live, creatorShare, parentShare, platformShare } = await processRevenueShare(
    localPaymentId,
    liveId,
    amount,
  );

  logger.info({
    event: 'mercadopago.payment.approved',
    paymentId: localPaymentId,
    liveId,
    amount,
    shares: {
      creator: creatorShare,
      parent: parentShare,
      platform: platformShare,
    },
  });

  await grantLiveAccess(userId, liveId);

  const profile = await getProfileById(userId);

  const emailTarget = profile?.email;
  const liveTitle = live?.title || `Live ${live?.id || liveId}`;
  const viewerUrl = live?.room_name ? generateAccessLink(live.room_name) : null;

  if (emailTarget) {
    try {
      await Promise.all([
        sendTransactionalEmail({
          to: emailTarget,
          type: 'payment_receipt',
          data: { amount, liveTitle },
        }),
        sendTransactionalEmail({
          to: emailTarget,
          type: 'access_granted',
          data: { liveTitle, viewerUrl: viewerUrl ?? undefined },
        }),
      ]);
    } catch (emailError) {
      logger.error({ event: 'email.failed', reason: 'payment_workflow', error: (emailError as Error).message });
    }
  }

  await markWebhookEventProcessed(idempotencyKey, bodyHash);

  return { processed: true };
};
