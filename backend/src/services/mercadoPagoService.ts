import { getEnv } from '../lib/env';
import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { registerCreditPurchase } from './creditsWalletService';
import { finalizeRegistrationReferral } from './affiliateService';
type RequestInit = globalThis.RequestInit;

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

export type PreferenceRequest = {
  liveId?: string;
  userId: string;
  price: number;
  purchaseType?: 'live' | 'credits' | 'registration' | string;
  paymentId?: string;
  referrerId?: string | null;
  referrerParentId?: string | null;
  isRootCreator?: boolean;
  newUserEmail?: string | null;
  inviteId?: string | null;
  metadata?: Record<string, unknown>;
  title?: string;
  description?: string;
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
  purchaseType,
  paymentId,
  referrerId,
  referrerParentId,
  isRootCreator,
  newUserEmail,
  inviteId,
  metadata,
  title,
  description,
}: PreferenceRequest): Promise<PreferenceResponse> => {
  const normalizedPurchase = (purchaseType || 'live').toLowerCase();
  const items = [
    {
      title:
        title || (normalizedPurchase === 'registration' ? 'Registration fee' : 'Live access purchase'),
      description:
        description ||
        (normalizedPurchase === 'registration'
          ? 'Platform registration fee'
          : `Access for live ${liveId ?? 'room'}`),
      quantity: 1,
      currency_id: 'BRL',
      unit_price: price,
    },
  ];

  const metadataPayload: Record<string, unknown> = {
    liveId,
    userId,
    purchaseType: normalizedPurchase,
    event_type: normalizedPurchase === 'registration' ? 'REGISTRATION' : normalizedPurchase.toUpperCase(),
    payment_id: paymentId,
    direct_id: referrerId ?? null,
    root_id: referrerParentId ?? null,
    referrer_id: referrerId ?? null,
    referrer_parent_id: referrerParentId ?? null,
    new_user_email: newUserEmail ?? null,
    invite_id: inviteId ?? null,
    is_root_creator: isRootCreator ?? false,
    ...(metadata || {}),
  };

  // Remove undefined keys
  Object.keys(metadataPayload).forEach((key) => {
    if (metadataPayload[key] === undefined) {
      delete metadataPayload[key];
    }
  });

  const preferencePayload: Record<string, unknown> = {
    items,
    metadata: metadataPayload,
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

export const createRegistrationPreference = async ({
  userId,
  parentId,
}: {
  userId: string;
  parentId: string;
}): Promise<PreferenceResponse> => {
  return createCheckoutPreference({
    userId,
    price: 5,
    purchaseType: 'registration',
    metadata: { parentId },
    title: 'Registration fee',
    description: 'Registration and activation payment',
  });
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
  metadata?: Record<string, unknown>;
  transaction_amount?: number;
  external_reference?: string | null;
};

type PaymentMetadata = {
  liveId?: unknown;
  live_id?: unknown;
  userId?: unknown;
  user_id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  parentId?: unknown;
  parent_id?: unknown;
  root_id?: unknown;
  event_type?: unknown;
  purchaseType?: unknown;
  purchase_type?: unknown;
  product?: unknown;
  new_user_email?: unknown;
  email?: unknown;
  direct_id?: unknown;
  referrer_id?: unknown;
  referrerId?: unknown;
  invite_id?: unknown;
  referral_code?: unknown;
  is_root_creator?: unknown;
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

  const metadata = (paymentDetails.metadata ?? {}) as PaymentMetadata;
  const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

  const liveId = asString(metadata.liveId) ?? asString(metadata.live_id);
  const userId = asString(metadata.userId) ?? asString(metadata.user_id);
  const profileId = asString(metadata.profileId) ?? asString(metadata.profile_id) ?? userId;
  const parentId =
    asString(metadata.parentId) ?? asString(metadata.parent_id) ?? asString(metadata.root_id) ?? null;
  const purchaseType = (
    asString(metadata.event_type) ||
    asString(metadata.purchaseType) ||
    asString(metadata.purchase_type) ||
    asString(metadata.product) ||
    ''
  ).toLowerCase();
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

  if (purchaseType === 'registration') {
  if (!userId) {
    throw new Error('Payment metadata missing userId for registration.');
  }

  const isRootCreatorFlag = String(metadata.is_root_creator ?? '').toLowerCase() === 'true';

  const email =
    asString(metadata.new_user_email) ??
    asString(metadata.email) ??
    null;

  const directId =
    asString(metadata.direct_id) ??
    asString(metadata.referrer_id) ??
    asString(metadata.referrerId) ??
    null;

  const inviteId =
    asString(metadata.invite_id) ??
    asString(metadata.referral_code) ??
    null;

  await finalizeRegistrationReferral({
    paymentId: paymentDetails.external_reference || paymentId,
    userId,
    email,
    directId,
    rootId: parentId,
    inviteId,
    isRootCreator: isRootCreatorFlag,
  });

  logger.info({
    event: 'registration.payment.processed',
    paymentId,
    userId,
    parentId,
    amountCents,
  });

  return { processed: true, mode: 'registration' };
}


  if (!liveId || !userId) {
    throw new Error('Payment metadata missing liveId or userId.');
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
