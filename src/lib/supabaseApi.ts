/**
 * API para interação com Supabase Edge Functions
 * Centraliza chamadas de autenticação, créditos e afiliados
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface CreditBalanceResponse {
  creditBalance: number;
  balance_credits: number;
  estimated_time: number;
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
