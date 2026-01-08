// backend/src/config/velanaConfig.ts

export interface VelanaConfig {
  apiKey: string;
  publicKey: string;
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
  const publicKey = process.env.VELANA_PUBLIC_KEY;
  const environment = (process.env.VELANA_ENVIRONMENT || 'production') as 'production' | 'sandbox';

  if (!apiKey || !publicKey) {
    throw new Error('Velana credentials not configured');
  }

  // URLs da API Velana (baseado na documentação)
  const baseUrl = environment === 'production' 
    ? 'https://api.velana.io'
    : 'https://sandbox.velana.io';

  return {
    apiKey,
    publicKey,
    baseUrl,
    environment,
  };
};

export const isVelanaEnabled = (): boolean => {
  return !!(process.env.VELANA_API_KEY && process.env.VELANA_PUBLIC_KEY);
};
