/**
 * API para interação com Supabase Edge Functions
 * Centraliza chamadas de autenticação, créditos, pagamentos e afiliados
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface CreditBalanceResponse {
  creditBalance: number;
  balance_credits: number;
  estimated_time: number;
}

export interface PaymentResponse {
  success?: boolean;
  transactionId?: string;
  externalRef?: string;
  secureUrl?: string;
  paymentId: string;
  amountCents?: number;
  amount: number;
  credits?: number;
  eventType?: string;
  purchaseType?: string;
  pix?: {
    qrCode: string;
    qrCodeImage?: string;
    expiresAt: string;
  };
}

export interface RegistrationResponse {
  success?: boolean;
  paymentId?: string;
  transactionId?: string;
  externalRef?: string;
  secureUrl?: string;
  amount?: number;
  status?: string;
  profileId?: string;
  token?: string | null;
  refresh_token?: string | null;
  pix?: {
    qrCode: string;
    qrCodeImage?: string;
    expiresAt: string;
  };
}

// Helper to get auth token
const getAuthToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

// ==================== CREDITS ====================

export const fetchCreditsBalance = async (): Promise<CreditBalanceResponse> => {
  logger.credits.info('Buscando saldo de créditos via edge function');
  
  const token = await getAuthToken();
  logger.credits.debug('Token obtido', { hasToken: !!token });
  
  if (!token) {
    logger.credits.warn('Sem token de autenticação, retornando saldo zero');
    return { creditBalance: 0, balance_credits: 0, estimated_time: 0 };
  }

  const url = `${SUPABASE_URL}/functions/v1/credits-balance`;
  logger.credits.debug('Chamando edge function', { url });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    logger.credits.debug('Resposta recebida', { 
      status: response.status, 
      ok: response.ok 
    });

    if (!response.ok) {
      const error = await response.json();
      logger.credits.error('Edge function retornou erro', { 
        status: response.status,
        error 
      });
      throw new Error(error.error || 'Failed to fetch credits balance');
    }

    const data = await response.json();
    logger.credits.info('Saldo obtido com sucesso', { 
      creditBalance: data.creditBalance,
      balance_credits: data.balance_credits,
      estimated_time: data.estimated_time,
    });

    return data;
  } catch (error) {
    logger.credits.error('Erro ao buscar saldo', {}, error as Error);
    throw error;
  }
};

// ==================== PAYMENTS (Velana PIX) ====================

export const createCreditsPayment = async (params: {
  credits: number;
  userId?: string;
}): Promise<PaymentResponse> => {
  logger.payment.info('Criando pagamento PIX Velana para créditos', { 
    credits: params.credits,
    userId: params.userId ?? 'auto-detect',
  });

  const token = await getAuthToken();
  const { data: { user } } = await supabase.auth.getUser();
  
  const userId = params.userId || user?.id;
  
  logger.payment.debug('Dados de autenticação', { 
    hasToken: !!token,
    userId,
  });

  if (!userId) {
    logger.payment.error('Usuário não autenticado');
    throw new Error('User not authenticated');
  }

  const url = `${SUPABASE_URL}/functions/v1/create-velana-payment`;
  const payload = {
    userId,
    purchaseType: 'credits',
    credits: params.credits,
  };

  logger.payment.info('Chamando edge function create-velana-payment', { url, payload });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    logger.payment.debug('Resposta recebida', { 
      status: response.status, 
      ok: response.ok 
    });

    if (!response.ok) {
      const error = await response.json();
      logger.payment.error('Edge function retornou erro', { 
        status: response.status,
        error,
        payload,
      });
      throw new Error(error.error || 'Failed to create payment');
    }

    const data = await response.json();
    logger.payment.info('Pagamento PIX Velana criado com sucesso', { 
      transactionId: data.transactionId,
      paymentId: data.paymentId,
      amount: data.amount,
      hasQrCode: !!data.pix?.qrCode,
    });

    return data;
  } catch (error) {
    logger.payment.error('Erro ao criar pagamento', { credits: params.credits }, error as Error);
    throw error;
  }
};

export const createSuperChatPayment = async (params: {
  userId: string;
  creatorId: string;
  roomId: string;
  tier: string;
  message: string;
}): Promise<PaymentResponse> => {
  logger.payment.info('Criando pagamento PIX Velana para SuperChat', params);

  const token = await getAuthToken();

  const url = `${SUPABASE_URL}/functions/v1/create-velana-payment`;
  const payload = {
    userId: params.userId,
    purchaseType: 'superchat',
    creatorId: params.creatorId,
    roomId: params.roomId,
    tier: params.tier,
    message: params.message,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create SuperChat payment');
    }

    const data = await response.json();
    logger.payment.info('SuperChat PIX Velana criado com sucesso', { 
      transactionId: data.transactionId,
      paymentId: data.paymentId,
      amount: data.amount,
    });

    return data;
  } catch (error) {
    logger.payment.error('Erro ao criar pagamento SuperChat', params, error as Error);
    throw error;
  }
};

export const createRegistrationPayment = async (params: {
  userId: string;
  referrerId?: string;
  rootId?: string;
  customerName?: string;
  customerEmail?: string;
}): Promise<PaymentResponse> => {
  logger.payment.info('Criando pagamento PIX Velana para registro', params);

  const url = `${SUPABASE_URL}/functions/v1/create-velana-payment`;
  const payload = {
    userId: params.userId,
    purchaseType: 'registration',
    referrerId: params.referrerId,
    rootId: params.rootId,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create registration payment');
    }

    const data = await response.json();
    logger.payment.info('Registration PIX Velana criado com sucesso', { 
      transactionId: data.transactionId,
      paymentId: data.paymentId,
    });

    return data;
  } catch (error) {
    logger.payment.error('Erro ao criar pagamento de registro', params, error as Error);
    throw error;
  }
};

// ==================== REGISTRATION ====================

/**
 * Creates a pending registration and generates PIX payment.
 * The user account is created ONLY after payment confirmation via webhook.
 * This prevents orphan accounts when users don't complete payment.
 */
export const registrationCheckout = async (params: {
  fullName: string;
  email: string;
  password: string;
  referralCode?: string;
  referrerId?: string;
  acceptTerms?: boolean;
  free?: boolean;
  root?: boolean;
}): Promise<RegistrationResponse> => {
  logger.register.info('Iniciando registration-checkout (pagamento primeiro)', {
    email: params.email,
    referralCode: params.referralCode ?? 'SEM_CODIGO',
    referrerId: params.referrerId ?? 'SEM_REFERRER',
  });

  const url = `${SUPABASE_URL}/functions/v1/registration-checkout`;
  
  // Map params to edge function expected format
  const payload = {
    email: params.email,
    password: params.password,
    username: params.fullName,
    referralCode: params.referralCode,
    referrerId: params.referrerId,
  };

  logger.register.debug('Chamando edge function', { 
    url,
    payload: { ...payload, password: '***REDACTED***' },
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    logger.register.debug('Resposta recebida', { 
      status: response.status, 
      ok: response.ok 
    });

    if (!response.ok) {
      const error = await response.json();
      logger.register.error('Edge function retornou erro', { 
        status: response.status,
        error,
        email: params.email,
      });
      throw new Error(error.error || 'Failed to process registration');
    }

    const data = await response.json();
    logger.register.info('Registration-checkout concluído', { 
      success: data.success,
      paymentId: data.paymentId,
      hasPix: !!data.pix?.qrCode,
    });

    return data;
  } catch (error) {
    logger.register.error('Erro no registration-checkout', { email: params.email }, error as Error);
    throw error;
  }
};

// ==================== AFFILIATE ====================

export const validateAffiliateCode = async (code: string): Promise<{ valid: boolean; ownerId: string | null }> => {
  logger.affiliate.info('Validando código de afiliado', { code });

  try {
    // Use RPC function to validate code (works for unauthenticated users)
    const { data, error } = await supabase.rpc('validate_referral_code', {
      p_code: code.toUpperCase()
    });

    if (error) {
      logger.affiliate.error('Erro na RPC de validação', { code }, error);
      return { valid: false, ownerId: null };
    }

    const isValid = !!data;
    logger.affiliate.info('Resultado da validação', { 
      code,
      valid: isValid,
      ownerId: data ?? null,
    });

    return { valid: isValid, ownerId: data || null };
  } catch (error) {
    logger.affiliate.error('Erro ao validar código', { code }, error as Error);
    return { valid: false, ownerId: null };
  }
};

export const getAffiliateCode = async (): Promise<{ code: string | null }> => {
  logger.affiliate.debug('Buscando código de afiliado do usuário');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      logger.affiliate.debug('Usuário não autenticado');
      return { code: null };
    }

    logger.affiliate.debug('Buscando código para usuário', { userId: user.id });

    const { data, error } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    if (error) {
      logger.affiliate.error('Erro ao buscar código', { userId: user.id }, error);
      return { code: null };
    }

    logger.affiliate.info('Código de afiliado obtido', { 
      userId: user.id,
      code: data?.referral_code ?? null,
    });

    return { code: data?.referral_code || null };
  } catch (error) {
    logger.affiliate.error('Erro fatal ao buscar código', {}, error as Error);
    return { code: null };
  }
};
