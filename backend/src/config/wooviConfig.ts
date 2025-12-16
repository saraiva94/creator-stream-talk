/**
 * Configuração da Woovi (OpenPix) para PIX Out
 * 
 * Documentação oficial: https://developers.openpix.com.br/
 * 
 * Configure as variáveis de ambiente:
 * - WOOVI_APP_ID: AppID gerado no painel Woovi
 * - WOOVI_WEBHOOK_SECRET: Secret para validar webhooks
 */

export interface WooviConfig {
  appId: string;
  baseUrl: string;
  webhookSecret: string;
  sandbox: boolean;
}

/**
 * Obtém configuração da Woovi a partir das variáveis de ambiente
 */
export function getWooviConfig(): WooviConfig {
  const appId = process.env.WOOVI_APP_ID || '';
  const webhookSecret = process.env.WOOVI_WEBHOOK_SECRET || '';
  const sandbox = process.env.WOOVI_SANDBOX === 'true';
  
  return {
    appId,
    webhookSecret,
    sandbox,
    baseUrl: sandbox 
      ? 'https://api.woovi-sandbox.com' 
      : 'https://api.openpix.com.br',
  };
}

/**
 * Valida se a configuração está completa
 */
export function validateWooviConfig(config: WooviConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.appId) {
    errors.push('WOOVI_APP_ID não configurado');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constantes de valores
 */
export const WOOVI_CONSTANTS = {
  /** Valor mínimo para saque em centavos (R$ 15,00) */
  MIN_WITHDRAW_CENTS: 1500,
  
  /** Timeout para chamadas à API em ms */
  API_TIMEOUT_MS: 30000,
  
  /** Intervalo de idempotência em segundos (evita duplicatas) */
  IDEMPOTENCY_WINDOW_SECONDS: 60,
};
