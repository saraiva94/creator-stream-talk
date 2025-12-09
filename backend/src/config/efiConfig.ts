/**
 * Configuração da Efí (EfiPay / antiga Gerencianet)
 * 
 * IMPORTANTE: Para usar em produção, configure as variáveis de ambiente:
 * - EFI_CLIENT_ID: Client ID da sua conta Efí
 * - EFI_CLIENT_SECRET: Client Secret da sua conta Efí
 * - EFI_SANDBOX: 'true' para sandbox, 'false' para produção
 * - EFI_PIX_KEY: Sua chave PIX cadastrada na Efí (para receber)
 * - EFI_WEBHOOK_SECRET: Secret para validar webhooks (se disponível)
 * 
 * Documentação oficial: https://dev.efipay.com.br/
 */

export interface EfiConfig {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  pixKey: string;
  webhookSecret: string;
  baseUrl: string;
}

/**
 * Obtém configuração da Efí a partir das variáveis de ambiente
 */
export function getEfiConfig(): EfiConfig {
  const sandbox = process.env.EFI_SANDBOX === 'true';
  
  return {
    clientId: process.env.EFI_CLIENT_ID || '',
    clientSecret: process.env.EFI_CLIENT_SECRET || '',
    sandbox,
    pixKey: process.env.EFI_PIX_KEY || '',
    webhookSecret: process.env.EFI_WEBHOOK_SECRET || '',
    // URLs oficiais da Efí
    baseUrl: sandbox 
      ? 'https://pix-h.api.efipay.com.br' 
      : 'https://pix.api.efipay.com.br',
  };
}

/**
 * Valida se a configuração está completa
 */
export function validateEfiConfig(config: EfiConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.clientId) {
    errors.push('EFI_CLIENT_ID não configurado');
  }
  
  if (!config.clientSecret) {
    errors.push('EFI_CLIENT_SECRET não configurado');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constantes de valores
 */
export const EFI_CONSTANTS = {
  /** Valor mínimo para saque em centavos (R$ 20,00) */
  MIN_WITHDRAW_CENTS: 2000,
  
  /** Timeout para chamadas à API em ms */
  API_TIMEOUT_MS: 30000,
  
  /** Intervalo de idempotência em segundos (evita duplicatas) */
  IDEMPOTENCY_WINDOW_SECONDS: 60,
};
