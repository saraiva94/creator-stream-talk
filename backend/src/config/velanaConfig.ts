// backend/src/config/velanaConfig.ts

export interface VelanaConfig {
  apiKey: string;
  baseUrl: string;
  environment: 'production' | 'sandbox';
}

export const VELANA_CONSTANTS = {
  MIN_WITHDRAW_CENTS: 1000,      // R$ 10,00 mínimo
  MAX_WITHDRAW_CENTS: 1000000,   // R$ 10.000,00 máximo por transação
  API_TIMEOUT_MS: 30000,
  IDEMPOTENCY_WINDOW_SECONDS: 60,
};

export const getVelanaConfig = (): VelanaConfig => {
  const apiKey = process.env.VELANA_API_KEY;
  const environment = (process.env.VELANA_ENVIRONMENT || 'production') as 'production' | 'sandbox';

  if (!apiKey) {
    throw new Error('VELANA_API_KEY not configured');
  }

  // URLs da API Velana (baseado na documentação oficial)
  const baseUrl = environment === 'production' 
    ? 'https://api.velana.com.br'
    : 'https://sandbox.velana.com.br';

  return {
    apiKey,
    baseUrl,
    environment,
  };
};

export const isVelanaEnabled = (): boolean => {
  return !!process.env.VELANA_API_KEY;
};
