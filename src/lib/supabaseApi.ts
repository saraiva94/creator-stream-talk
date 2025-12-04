import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface CreditBalanceResponse {
  creditBalance: number;
  balance_credits: number;
  estimated_time: number;
}

export interface PaymentResponse {
  init_point: string;
  preferenceId: string;
  paymentId: string;
  amount: number;
  credits?: number;
}

export interface RegistrationResponse {
  init_point?: string;
  preferenceId?: string;
  paymentId?: string;
  amount?: number;
  status?: string;
  profileId?: string;
  token?: string | null;
  refresh_token?: string | null;
}

// Helper to get auth token
const getAuthToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

// Credits balance - uses edge function
export const fetchCreditsBalance = async (): Promise<CreditBalanceResponse> => {
  const token = await getAuthToken();
  
  if (!token) {
    return { creditBalance: 0, balance_credits: 0, estimated_time: 0 };
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/credits-balance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch credits balance');
  }

  return response.json();
};

// Create payment for credits - uses edge function
export const createCreditsPayment = async (params: {
  credits: number;
  userId?: string;
}): Promise<PaymentResponse> => {
  const token = await getAuthToken();
  const { data: { user } } = await supabase.auth.getUser();
  
  const userId = params.userId || user?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      purchaseType: 'credits',
      credits: params.credits,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment');
  }

  return response.json();
};

// Registration checkout - uses edge function
export const registrationCheckout = async (params: {
  fullName: string;
  email: string;
  password: string;
  referralCode?: string;
  acceptTerms: boolean;
  free?: boolean;
  root?: boolean;
}): Promise<RegistrationResponse> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/registration-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process registration');
  }

  return response.json();
};

// Validate affiliate code
export const validateAffiliateCode = async (code: string): Promise<{ valid: boolean; ownerId: string | null }> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error validating code:', error);
    return { valid: false, ownerId: null };
  }

  return { valid: !!data, ownerId: data?.id || null };
};

// Get user's affiliate code
export const getAffiliateCode = async (): Promise<{ code: string | null }> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { code: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching affiliate code:', error);
    return { code: null };
  }

  return { code: data?.referral_code || null };
};
