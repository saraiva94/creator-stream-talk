// backend/src/services/velanaPixService.ts

import { getVelanaConfig, VELANA_CONSTANTS } from '../config/velanaConfig';
import { logger } from '../lib/logger';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface VelanaPixTransferParams {
  userId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  correlationId: string;
  description?: string;
}

export interface VelanaPixTransferResponse {
  success: boolean;
  transferId?: string;
  status?: string;
  rawResponse?: unknown;
  error?: string;
}

/**
 * Cria uma transferência PIX via Velana.io
 * Baseado na documentação: https://velana.readme.io/reference/introducao
 */
export async function createPixTransfer(
  params: VelanaPixTransferParams
): Promise<VelanaPixTransferResponse> {
  const config = getVelanaConfig();

  // Valida valor mínimo
  if (params.amountCents < VELANA_CONSTANTS.MIN_WITHDRAW_CENTS) {
    return {
      success: false,
      error: `Valor mínimo: R$ ${(VELANA_CONSTANTS.MIN_WITHDRAW_CENTS / 100).toFixed(2)}`,
    };
  }

  // Valida valor máximo
  if (params.amountCents > VELANA_CONSTANTS.MAX_WITHDRAW_CENTS) {
    return {
      success: false,
      error: `Valor máximo por transação: R$ ${(VELANA_CONSTANTS.MAX_WITHDRAW_CENTS / 100).toFixed(2)}`,
    };
  }

  // Velana POST /v1/transfers espera amount em CENTAVOS
  // Payload conforme documentação Velana
  const postbackUrl = process.env.SUPABASE_URL 
    ? `${process.env.SUPABASE_URL}/functions/v1/velana-webhook`
    : undefined;

  const payload = {
    amount: params.amountCents, // Velana espera em centavos (integer)
    pixKey: params.pixKey,
    postbackUrl: postbackUrl,
    externalId: params.correlationId,
    description: params.description || 'Saque PIX - Stream Star',
  };

  try {
    logger.info('[VelanaPix] Creating transfer', {
      userId: params.userId,
      amountCents: params.amountCents,
      correlationId: params.correlationId,
      postbackUrl,
    });

    // Velana usa Basic Auth: base64(SECRET_KEY:x)
    const authHeader = `Basic ${Buffer.from(`${config.apiKey}:x`).toString('base64')}`;

    const response = await fetch(`${config.baseUrl}/v1/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(VELANA_CONSTANTS.API_TIMEOUT_MS),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('[VelanaPix] Transfer failed', {
        status: response.status,
        error: data,
      });

      return {
        success: false,
        error: data.message || data.error || 'Falha ao processar transferência PIX',
        rawResponse: data,
      };
    }

    logger.info('[VelanaPix] Transfer success', {
      transferId: data.id,
      status: data.status,
    });

    return {
      success: true,
      transferId: data.id,
      status: data.status,
      rawResponse: data,
    };
  } catch (error) {
    logger.error('[VelanaPix] Transfer exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao conectar com Velana',
    };
  }
}

/**
 * Consulta o status de uma transferência PIX
 */
export async function getPixTransferStatus(
  transferId: string
): Promise<{ success: boolean; status?: string; data?: unknown; error?: string }> {
  const config = getVelanaConfig();

  try {
    // Velana usa Basic Auth
    const authHeader = `Basic ${Buffer.from(`${config.apiKey}:x`).toString('base64')}`;

    const response = await fetch(`${config.baseUrl}/v1/transfers/${transferId}`, {
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
        error: data.message || 'Falha ao consultar status',
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

/**
 * Detecta o tipo de chave PIX automaticamente
 */
export function detectPixKeyType(pixKey: string): PixKeyType {
  const cleanKey = pixKey.replace(/\D/g, '');

  // CPF (11 dígitos)
  if (/^\d{11}$/.test(cleanKey)) {
    return 'CPF';
  }

  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(cleanKey)) {
    return 'CNPJ';
  }

  // Email
  if (/@/.test(pixKey)) {
    return 'EMAIL';
  }

  // Telefone (+55 11 99999-9999)
  if (/^\+?\d{10,13}$/.test(cleanKey)) {
    return 'PHONE';
  }

  // Chave aleatória
  return 'RANDOM';
}

/**
 * Valida formato de chave PIX
 */
export function validatePixKey(pixKey: string, type: PixKeyType): { valid: boolean; error?: string } {
  const cleanKey = pixKey.replace(/\D/g, '');

  switch (type) {
    case 'CPF':
      if (!/^\d{11}$/.test(cleanKey)) {
        return { valid: false, error: 'CPF deve ter 11 dígitos' };
      }
      break;

    case 'CNPJ':
      if (!/^\d{14}$/.test(cleanKey)) {
        return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
      }
      break;

    case 'EMAIL':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
        return { valid: false, error: 'Email inválido' };
      }
      break;

    case 'PHONE':
      if (!/^\+?\d{10,13}$/.test(cleanKey)) {
        return { valid: false, error: 'Telefone inválido' };
      }
      break;

    case 'RANDOM':
      if (pixKey.length < 32) {
        return { valid: false, error: 'Chave aleatória inválida' };
      }
      break;
  }

  return { valid: true };
}
