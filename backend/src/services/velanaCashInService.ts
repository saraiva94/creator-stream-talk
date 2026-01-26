// backend/src/services/velanaCashInService.ts
// Velana Cash-In service - PIX payment collection

import { getVelanaConfig, VELANA_CONSTANTS } from '../config/velanaConfig';
import { logger } from '../lib/logger';

export type VelanaEventType = 
  | 'REGISTRATION' 
  | 'CREDITS_PURCHASE' 
  | 'LIVE_ACCESS' 
  | 'SUPERCHAT';

export interface VelanaCustomer {
  name: string;
  email: string;
  document: {
    type: 'cpf' | 'cnpj';
    number: string;
  };
  phone?: string;
}

export interface VelanaItem {
  externalRef?: string;
  title: string;
  unitPrice: number; // in cents
  quantity: number;
  tangible: boolean;
}

export interface VelanaPixExpiration {
  expiresIn?: number; // seconds until expiration (default: 3600 = 1 hour)
}

export interface VelanaTransactionParams {
  amount: number; // in cents
  customer: VelanaCustomer;
  items: VelanaItem[];
  pix?: VelanaPixExpiration;
  postbackUrl: string;
  metadata?: string;
  externalRef?: string;
}

export interface VelanaPixQRCode {
  qrCode: string;        // PIX Copy & Paste string
  qrCodeImage?: string;  // Base64 QR code image or URL
  expiresAt: string;     // ISO timestamp
}

export interface VelanaTransactionResponse {
  success: boolean;
  transactionId?: string;
  secureId?: string;
  secureUrl?: string;
  status?: string;
  pix?: VelanaPixQRCode;
  rawResponse?: unknown;
  error?: string;
}

interface CreatePaymentParams {
  amountCents: number;
  userId: string;
  eventType: VelanaEventType;
  customer: {
    name: string;
    email: string;
    cpf: string;
    phone?: string;
  };
  metadata: {
    userId: string;
    eventType: VelanaEventType;
    liveId?: string;
    roomId?: string;
    creatorId?: string;
    credits?: number;
    directId?: string;
    rootId?: string;
    tier?: string;
    duration?: number;
    message?: string;
    [key: string]: unknown;
  };
  description?: string;
  webhookUrl: string;
  externalReference?: string;
}

/**
 * Creates a PIX payment transaction via Velana.io
 * Based on documentation: https://velana.readme.io/reference/criar-transacao
 */
export async function createPixPayment(
  params: CreatePaymentParams
): Promise<VelanaTransactionResponse> {
  const config = getVelanaConfig();

  if (params.amountCents < 100) {
    return {
      success: false,
      error: 'Valor mínimo: R$ 1,00',
    };
  }

  // Convert CPF to clean format
  const cleanCpf = params.customer.cpf.replace(/\D/g, '');
  const cleanPhone = params.customer.phone?.replace(/\D/g, '');

  // Build customer object
  const customer: VelanaCustomer = {
    name: params.customer.name,
    email: params.customer.email,
    document: {
      type: cleanCpf.length === 14 ? 'cnpj' : 'cpf',
      number: cleanCpf,
    },
  };

  if (cleanPhone) {
    customer.phone = cleanPhone;
  }

  // Build items
  const items: VelanaItem[] = [
    {
      externalRef: params.externalReference,
      title: params.description || 'Stream Star',
      unitPrice: params.amountCents,
      quantity: 1,
      tangible: false,
    },
  ];

  // Serialize metadata to string (Velana expects string metadata)
  const metadataString = JSON.stringify({
    ...params.metadata,
    payment_id: params.externalReference,
  });

  const payload: VelanaTransactionParams = {
    amount: params.amountCents,
    customer,
    items,
    pix: {
      expiresIn: 3600, // 1 hour
    },
    postbackUrl: params.webhookUrl,
    metadata: metadataString,
    externalRef: params.externalReference,
  };

  try {
    logger.info('[VelanaCashIn] Creating PIX transaction', {
      userId: params.userId,
      amountCents: params.amountCents,
      eventType: params.eventType,
      externalRef: params.externalReference,
    });

    // Velana uses Basic Auth with API key
    const authHeader = 'Basic ' + Buffer.from(`${config.apiKey}:x`).toString('base64');

    const response = await fetch(`${config.baseUrl}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        ...payload,
        paymentMethod: 'pix',
      }),
      signal: AbortSignal.timeout(VELANA_CONSTANTS.API_TIMEOUT_MS),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('[VelanaCashIn] Transaction failed', {
        status: response.status,
        error: data,
      });

      return {
        success: false,
        error: data.message || data.error || 'Falha ao criar transação PIX',
        rawResponse: data,
      };
    }

    logger.info('[VelanaCashIn] Transaction created', {
      transactionId: data.id,
      status: data.status,
      secureId: data.secureId,
    });

    // Extract PIX QR code data
    const pixData: VelanaPixQRCode | undefined = data.pix ? {
      qrCode: data.pix.qrCode || data.pix.qr_code || data.pix.code,
      qrCodeImage: data.pix.qrCodeImage || data.pix.qr_code_image || data.pix.image,
      expiresAt: data.pix.expiresAt || data.pix.expires_at || new Date(Date.now() + 3600000).toISOString(),
    } : undefined;

    return {
      success: true,
      transactionId: String(data.id),
      secureId: data.secureId,
      secureUrl: data.secureUrl,
      status: data.status,
      pix: pixData,
      rawResponse: data,
    };
  } catch (error) {
    logger.error('[VelanaCashIn] Transaction exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao conectar com Velana',
    };
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  transactionId: string
): Promise<{ success: boolean; status?: string; data?: unknown; error?: string }> {
  const config = getVelanaConfig();

  try {
    const authHeader = 'Basic ' + Buffer.from(`${config.apiKey}:x`).toString('base64');

    const response = await fetch(`${config.baseUrl}/v1/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
      signal: AbortSignal.timeout(VELANA_CONSTANTS.API_TIMEOUT_MS),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Falha ao consultar transação',
      };
    }

    return {
      success: true,
      status: data.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao consultar status',
    };
  }
}

// Credit packages: credits -> price in cents
export const CREDITS_PACKAGES: Record<number, number> = {
  180: 500,    // R$ 5.00 for 30 min
  360: 900,    // R$ 9.00 for 1 hour
  720: 1600,   // R$ 16.00 for 2 hours
  1800: 3500,  // R$ 35.00 for 5 hours
};

// SuperChat tiers
export const SUPERCHAT_TIERS = {
  blue: { amountCents: 300, duration: 60 },
  yellow: { amountCents: 500, duration: 120 },
  red: { amountCents: 800, duration: 180 },
} as const;

// Registration price in cents
export const REGISTRATION_PRICE_CENTS = 700; // R$ 7.00

/**
 * Calculate credits from amount in cents
 */
export function calculateCreditsFromAmount(amountCents: number): number {
  // 180 credits for each R$5.00 (500 cents)
  return Math.round((amountCents / 500) * 180);
}
