import fetch, { RequestInit } from 'node-fetch';
import { getEnv } from '../lib/env';
import { supabase } from '../lib/supabaseClient';

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

const fetchPaymentDetails = async (paymentId: string) => {
  return request<{ status: string; metadata?: Record<string, string> }>(
    `/v1/payments/${paymentId}`,
    { method: 'GET' },
  );
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

  if (!liveId || !userId) {
    throw new Error('Payment metadata missing liveId or userId.');
  }

  await persistApprovedPayment(liveId, userId);

  return { processed: true };
};
