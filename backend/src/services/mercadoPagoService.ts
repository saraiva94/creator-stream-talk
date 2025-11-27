import fetch, { RequestInit } from 'node-fetch';
import { getEnv } from '../lib/env';
import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { registerCreditPurchase } from './creditsWalletService';
import { registerAffiliatePayoutForSignup } from './affiliateService';

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

export type PreferenceRequest = {
  liveId: string;
  userId: string;
  price: number;
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

const getAccessToken = () => getEnv('MERCADOPAGO_ACCESS_TOKEN');

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
}: PreferenceRequest): Promise<PreferenceResponse> => {
  const items = [
    {
      title: 'Live access purchase',
      description: `Access for live ${liveId}`,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: price,
    },
  ];

  const preferencePayload: Record<string, unknown> = {
    items,
    metadata: {
      liveId,
      userId,
    },
    auto_return: 'approved',
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

const isSignatureValid = (signatureHeader?: string) => {
  if (!signatureHeader) {
    console.warn('Mercado Pago signature header missing; skipping structural validation.');
    return true;
  }

  const parts = signatureHeader.split(',');
  const hasTimestamp = parts.some((part) => part.trim().startsWith('ts='));
  const hasSignature = parts.some((part) => part.trim().startsWith('v1='));

  return hasTimestamp && hasSignature;
};

const resolvePaymentId = (payload: WebhookPayload): string | undefined => {
  return payload?.data?.id || payload?.resource?.split('/').pop();
};

type PaymentDetailsResponse = {
  status: string;
  metadata?: Record<string, string>;
  transaction_amount?: number;
  external_reference?: string | null;
};

const fetchPaymentDetails = async (paymentId: string) => {
  return request<PaymentDetailsResponse>(`/v1/payments/${paymentId}`, { method: 'GET' });
};

const persistApprovedPayment = async (liveId: string, userId: string) => {
  const { error } = await supabase
    .from('live_access')
    .upsert(
      {
        live_id: liveId,
        user_id: userId,
        status: 'approved',
        granted_at: new Date().toISOString(),
      },
      { onConflict: 'live_id,user_id' },
    );

  if (error) {
    throw new Error(`Failed to store payment approval: ${error.message}`);
  }
};

export const handlePaymentWebhook = async (
  payload: WebhookPayload,
  headers: { signature?: string; requestId?: string },
) => {
  if (!isSignatureValid(headers.signature)) {
    throw new Error('Invalid Mercado Pago webhook signature.');
  }

  const paymentId = resolvePaymentId(payload);
  if (!paymentId) {
    throw new Error('Missing payment identifier in webhook payload.');
  }

  const paymentDetails = await fetchPaymentDetails(paymentId);
  if (paymentDetails.status !== 'approved') {
    return { processed: false, reason: 'Payment not approved' };
  }

  const metadata = paymentDetails.metadata || {};
  const liveId = metadata.liveId || metadata.live_id;
  const userId = metadata.userId || metadata.user_id;
  const profileId = metadata.profileId || metadata.profile_id || userId;
  const purchaseType = (metadata.purchaseType || metadata.purchase_type || metadata.product || '').toLowerCase();
  const amountCents = resolveAmountCents(paymentDetails.transaction_amount);

  if (purchaseType === 'credits') {
    if (!profileId) {
      throw new Error('Payment metadata missing profileId for credits purchase.');
    }

    const amountCentsRaw = paymentDetails.transaction_amount ?? null;
    const amountCents = Number.isFinite(amountCentsRaw) ? Math.round((amountCentsRaw as number) * 100) : NaN;

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error('Invalid amount for credits purchase.');
    }

    const credits = calculateCreditsFromAmount(amountCents);

    await registerCreditPurchase({
      profileId,
      credits,
      amountCents,
      paymentId: paymentDetails.external_reference || paymentId,
    });

    logger.info({
      event: 'credits.purchase.approved',
      profileId,
      paymentId,
      externalReference: paymentDetails.external_reference,
      amountCents,
      credits,
    });

    return { processed: true, mode: 'credits' };
  }

  if (!liveId || !userId) {
    throw new Error('Payment metadata missing liveId or userId.');
  }

  if (purchaseType === 'registration' && userId) {
    await registerAffiliatePayoutForSignup({
      newUserId: userId,
      paymentId,
      amountCents: Number.isFinite(amountCents) ? amountCents : undefined,
    });
  }

  await persistApprovedPayment(liveId, userId);

  return { processed: true, mode: 'live_access' };
};

const resolveAmountCents = (transactionAmount?: number | null) => {
  if (!Number.isFinite(transactionAmount as number)) return NaN;
  return Math.round((transactionAmount as number) * 100);
};

export const calculateCreditsFromAmount = (amountCents: number) => {
  // 180 credits for each R$5.00 (500 cents). Assume amount_cents is a multiple of 500.
  return Math.round((amountCents / 500) * 180);
};
