/**
 * Serviço de integração com a API da Woovi (OpenPix)
 * 
 * Documentação oficial: https://developers.openpix.com.br/
 * 
 * Este serviço implementa as chamadas à API da Woovi para PIX-out (saques).
 */

import { getWooviConfig, validateWooviConfig, WOOVI_CONSTANTS } from '../config/wooviConfig';
import { logger } from '../lib/logger';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface WooviPixPaymentParams {
  userId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  correlationId: string;
  comment?: string;
}

export interface WooviPixPaymentResult {
  paymentId?: string;
  status: string;
  rawResponse: unknown;
}

interface WooviPaymentResponse {
  payment?: {
    value: number;
    status: string;
    correlationID: string;
    destinationAlias: string;
  };
  error?: string;
  message?: string;
}

/**
 * Máscara a chave PIX para logs (segurança)
 */
function maskPixKey(pixKey: string): string {
  if (!pixKey || pixKey.length <= 6) return '***';
  return `${pixKey.substring(0, 3)}***${pixKey.substring(pixKey.length - 3)}`;
}

/**
 * Detecta tipo de chave PIX automaticamente
 */
export function detectPixKeyType(pixKey: string): PixKeyType {
  const cleanKey = pixKey.replace(/[^\w@.+-]/g, '');
  
  if (/^\d{11}$/.test(cleanKey)) return 'CPF';
  if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanKey)) return 'EMAIL';
  if (/^\+?\d{10,13}$/.test(cleanKey)) return 'PHONE';
  
  return 'RANDOM';
}

/**
 * Cria um pagamento PIX (saque) via Woovi/OpenPix
 * 
 * Endpoint: POST /api/v1/payment
 * Documentação: https://developers.openpix.com.br/docs/payment/payment-create
 * 
 * @param params Parâmetros do pagamento PIX
 * @returns Resultado com status e payload
 */
export async function createPixPayment(
  params: WooviPixPaymentParams
): Promise<WooviPixPaymentResult> {
  const config = getWooviConfig();
  const validation = validateWooviConfig(config);

  if (!validation.valid) {
    logger.error('[WooviPix] Invalid configuration', { errors: validation.errors });
    throw new Error(`Configuração da Woovi inválida: ${validation.errors.join(', ')}`);
  }

  // Validar valor mínimo
  if (params.amountCents < WOOVI_CONSTANTS.MIN_WITHDRAW_CENTS) {
    throw new Error(`Valor mínimo para saque é de R$ ${(WOOVI_CONSTANTS.MIN_WITHDRAW_CENTS / 100).toFixed(2)}`);
  }

  const payload = {
    value: params.amountCents, // Woovi usa centavos
    destinationAlias: params.pixKey,
    destinationAliasType: params.pixKeyType,
    correlationID: params.correlationId,
    comment: params.comment || 'Saque Stream Live Hub',
  };

  logger.info('[WooviPix] Creating PIX payment', {
    userId: params.userId,
    amountCents: params.amountCents,
    pixKey: maskPixKey(params.pixKey),
    pixKeyType: params.pixKeyType,
    correlationId: params.correlationId,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WOOVI_CONSTANTS.API_TIMEOUT_MS);

    const response = await fetch(`${config.baseUrl}/api/v1/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.appId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: WooviPaymentResponse;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { error: responseText };
    }

    if (!response.ok) {
      logger.error('[WooviPix] PIX payment failed', {
        status: response.status,
        error: responseData,
        pixKey: maskPixKey(params.pixKey),
        correlationId: params.correlationId,
      });
      
      throw new Error(
        `Erro ao processar PIX: ${responseData.message || responseData.error || 'Erro desconhecido'}`
      );
    }

    logger.info('[WooviPix] PIX payment created successfully', {
      correlationId: params.correlationId,
      status: responseData.payment?.status || 'CREATED',
      pixKey: maskPixKey(params.pixKey),
    });

    return {
      paymentId: responseData.payment?.correlationID,
      status: responseData.payment?.status || 'CREATED',
      rawResponse: responseData,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('[WooviPix] Request timeout', { correlationId: params.correlationId });
      throw new Error('Timeout ao processar PIX - tente novamente');
    }

    logger.error('[WooviPix] Error creating PIX payment', { 
      error,
      pixKey: maskPixKey(params.pixKey),
      correlationId: params.correlationId,
    });
    throw error;
  }
}

/**
 * Consulta status de um pagamento PIX (se necessário)
 * 
 * Endpoint: GET /api/v1/payment/{correlationId}
 */
export async function getPixPaymentStatus(
  correlationId: string
): Promise<{ status: string; rawResponse: unknown }> {
  const config = getWooviConfig();
  
  logger.info('[WooviPix] Checking PIX payment status', { correlationId });

  try {
    const response = await fetch(`${config.baseUrl}/api/v1/payment/${correlationId}`, {
      method: 'GET',
      headers: {
        'Authorization': config.appId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[WooviPix] Failed to get PIX status', { 
        status: response.status, 
        error: errorText, 
        correlationId 
      });
      throw new Error(`Falha ao consultar status do PIX: ${response.status}`);
    }

    const data = await response.json();

    logger.info('[WooviPix] PIX status retrieved', { 
      correlationId, 
      status: data.payment?.status 
    });

    return {
      status: data.payment?.status || 'UNKNOWN',
      rawResponse: data,
    };
  } catch (error) {
    logger.error('[WooviPix] Error getting PIX status', { error, correlationId });
    throw error;
  }
}
