/**
 * Serviço de integração com a API da Efí (EfiPay)
 * 
 * Documentação oficial: https://dev.efipay.com.br/
 * 
 * IMPORTANTE: Este serviço implementa as chamadas à API da Efí para PIX-out.
 * Antes de usar em produção:
 * 1. Configure as credenciais (EFI_CLIENT_ID, EFI_CLIENT_SECRET)
 * 2. Cadastre o webhook no painel da Efí
 * 3. Teste no ambiente sandbox
 */

import { getEfiConfig, validateEfiConfig, EFI_CONSTANTS } from '../config/efiConfig';
import { logger } from '../lib/logger';

interface EfiTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface EfiPixPaymentRequest {
  valor: {
    original: string; // formato "20.00"
  };
  chave: string; // chave PIX do destinatário
  solicitacaoPagador?: string; // descrição (opcional)
  infoPagador?: string; // info adicional (opcional)
}

interface EfiPixPaymentResponse {
  txid: string;
  e2eId?: string;
  valor: {
    original: string;
  };
  chave: string;
  status: string;
  horario?: {
    solicitacao: string;
    liquidacao?: string;
  };
}

interface EfiErrorResponse {
  nome?: string;
  mensagem?: string;
  erros?: Array<{ caminho: string; mensagem: string }>;
}

// Cache do token de acesso
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtém token de acesso OAuth2 da Efí
 * 
 * Endpoint: POST /oauth/token
 * Documentação: https://dev.efipay.com.br/docs/api-pix/autenticacao
 */
async function getAccessToken(): Promise<string> {
  const config = getEfiConfig();
  
  // Retorna token em cache se ainda válido
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  logger.info('[EfiApi] Requesting new access token');

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  try {
    const response = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[EfiApi] Failed to get access token', { status: response.status, error: errorText });
      throw new Error(`Falha na autenticação com Efí: ${response.status}`);
    }

    const data = await response.json() as EfiTokenResponse;
    
    // Cache do token (com 1 minuto de margem)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    logger.info('[EfiApi] Access token obtained successfully');
    return data.access_token;
  } catch (error) {
    logger.error('[EfiApi] Error getting access token', { error });
    throw error;
  }
}

/**
 * Máscara a chave PIX para logs (segurança)
 */
function maskPixKey(pixKey: string): string {
  if (pixKey.length <= 6) return '***';
  return `${pixKey.substring(0, 3)}***${pixKey.substring(pixKey.length - 3)}`;
}

/**
 * Envia pagamento PIX via Efí
 * 
 * Endpoint: POST /v2/pix
 * Documentação: https://dev.efipay.com.br/docs/api-pix/pagar-pix
 * 
 * @param amountCents Valor em centavos
 * @param pixKey Chave PIX do destinatário
 * @param description Descrição do pagamento
 * @returns Resposta da Efí com txid e status
 */
export async function sendPixPayment(
  amountCents: number,
  pixKey: string,
  description?: string
): Promise<{ txid: string; status: string; e2eId?: string }> {
  const config = getEfiConfig();
  const validation = validateEfiConfig(config);

  if (!validation.valid) {
    logger.error('[EfiApi] Invalid configuration', { errors: validation.errors });
    throw new Error(`Configuração da Efí inválida: ${validation.errors.join(', ')}`);
  }

  // Validar valor mínimo
  if (amountCents < EFI_CONSTANTS.MIN_WITHDRAW_CENTS) {
    throw new Error(`Valor mínimo para saque é de R$ ${(EFI_CONSTANTS.MIN_WITHDRAW_CENTS / 100).toFixed(2)}`);
  }

  const token = await getAccessToken();
  
  // Converter centavos para formato decimal (ex: 2000 -> "20.00")
  const valorOriginal = (amountCents / 100).toFixed(2);

  const payload: EfiPixPaymentRequest = {
    valor: {
      original: valorOriginal,
    },
    chave: pixKey,
    solicitacaoPagador: description || 'Saque Stream Live Hub',
  };

  logger.info('[EfiApi] Sending PIX payment', {
    amountCents,
    pixKey: maskPixKey(pixKey),
    valor: valorOriginal,
  });

  try {
    // TODO: Verificar endpoint correto na documentação da Efí
    // Para envio de PIX (Pix-out), o endpoint pode ser diferente
    // Consulte: https://dev.efipay.com.br/docs/api-pix/pagar-pix
    const response = await fetch(`${config.baseUrl}/v2/pix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorData: EfiErrorResponse;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { mensagem: responseText };
      }
      
      logger.error('[EfiApi] PIX payment failed', {
        status: response.status,
        error: errorData,
        pixKey: maskPixKey(pixKey),
      });
      
      throw new Error(`Erro ao processar PIX: ${errorData.mensagem || 'Erro desconhecido'}`);
    }

    const data = JSON.parse(responseText) as EfiPixPaymentResponse;

    logger.info('[EfiApi] PIX payment sent successfully', {
      txid: data.txid,
      status: data.status,
      pixKey: maskPixKey(pixKey),
    });

    return {
      txid: data.txid,
      status: data.status,
      e2eId: data.e2eId,
    };
  } catch (error) {
    logger.error('[EfiApi] Error sending PIX payment', { 
      error,
      pixKey: maskPixKey(pixKey),
    });
    throw error;
  }
}

/**
 * Consulta status de um pagamento PIX
 * 
 * Endpoint: GET /v2/pix/{txid}
 */
export async function getPixPaymentStatus(txid: string): Promise<{ status: string; e2eId?: string }> {
  const config = getEfiConfig();
  const token = await getAccessToken();

  logger.info('[EfiApi] Checking PIX payment status', { txid });

  try {
    const response = await fetch(`${config.baseUrl}/v2/pix/${txid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[EfiApi] Failed to get PIX status', { status: response.status, error: errorText, txid });
      throw new Error(`Falha ao consultar status do PIX: ${response.status}`);
    }

    const data = await response.json() as EfiPixPaymentResponse;

    logger.info('[EfiApi] PIX status retrieved', { txid, status: data.status });

    return {
      status: data.status,
      e2eId: data.e2eId,
    };
  } catch (error) {
    logger.error('[EfiApi] Error getting PIX status', { error, txid });
    throw error;
  }
}

/**
 * Valida assinatura do webhook da Efí
 * 
 * IMPORTANTE: Implemente a validação conforme documentação da Efí
 * https://dev.efipay.com.br/docs/api-pix/webhooks
 */
export function validateWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const config = getEfiConfig();
  
  if (!config.webhookSecret) {
    logger.warn('[EfiApi] Webhook secret not configured, skipping validation');
    return true; // Em desenvolvimento, aceita sem validação
  }

  // TODO: Implementar validação de assinatura conforme documentação da Efí
  // A Efí pode usar HMAC-SHA256 ou outro método
  // Consulte: https://dev.efipay.com.br/docs/api-pix/webhooks
  
  logger.info('[EfiApi] Webhook signature validation (placeholder)');
  return true;
}
