import { supabase } from '@/integrations/supabase/client';
const AUTH_REDIRECT_PATH = '/auth';
let redirectingDueToAuthError = false;

const resolveBaseUrl = () => {
  const envBase =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_PUBLIC_BASE_URL ||
    undefined;

  const normalize = (value: string) => value.replace(/\/$/, '');

  if (envBase) {
    return normalize(envBase);
  }

  const inferredOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:4000';

  return normalize(inferredOrigin);
};

const API_BASE_URL = resolveBaseUrl();

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthMode = 'required' | 'optional' | 'none';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const accessTokenCache: { token: string | null; fetchedAt: number } = {
  token: null,
  fetchedAt: 0,
};

const ACCESS_TOKEN_TTL_MS = 30 * 1000;

const withFallback = async <T>(primary: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> => {
  try {
    return await primary();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && fallback) {
      return fallback();
    }
    throw error;
  }
};

const resolveAccessToken = async (): Promise<string | null> => {
  if (Date.now() - accessTokenCache.fetchedAt < ACCESS_TOKEN_TTL_MS) {
    return accessTokenCache.token;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.debug('[api] Failed to read Supabase session', error);
    accessTokenCache.token = null;
    accessTokenCache.fetchedAt = Date.now();
    return null;
  }

  accessTokenCache.token = data.session?.access_token ?? null;
  accessTokenCache.fetchedAt = Date.now();
  return accessTokenCache.token;
};

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: AuthMode;
  signal?: AbortSignal;
}

const fetchAffiliateStats = () =>
  request<AffiliateStatsResponse>('/affiliate/overview', { method: 'GET', auth: 'required' });

const fetchAffiliateHistory = () =>
  request<AffiliateHistoryEntry[]>('/affiliate/history', { method: 'GET', auth: 'required' });

const resolveUsernameToEmail = (username: string) =>
  request<{ email: string }>(`/auth/resolve-username?username=${encodeURIComponent(username)}`, {
    method: 'GET',
    auth: 'none',
  });

const fetchReferralLink = () =>
  request<{ code: string; url: string }>('/affiliate/link', { method: 'GET', auth: 'required' });

const handleApiError = async (path: string, error: ApiError): Promise<never> => {
  console.debug('[api] request failed', { path, status: error.status, message: error.message });

  if (error.status === 401 || error.status === 403) {
    accessTokenCache.token = null;
    accessTokenCache.fetchedAt = 0;
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.debug('[api] sign out failed after auth error', signOutError);
    }

    if (typeof window !== 'undefined' && !redirectingDueToAuthError) {
      redirectingDueToAuthError = true;
      window.location.assign(AUTH_REDIRECT_PATH);
    }
  }

  throw error;
};

const buildUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = 'optional', signal } = options;
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };

  let payload: BodyInit | undefined;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
      payload = JSON.stringify(body);
    }
  }

  if (auth !== 'none') {
    const token = await resolveAccessToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    } else if (auth === 'required') {
      return handleApiError(path, new ApiError('Authentication required', 401));
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: finalHeaders,
      body: payload,
      signal,
    });
  } catch (networkError) {
    const apiError = new ApiError('Network request failed', 0, networkError);
    return handleApiError(path, apiError);
  }

  const responseText = await response.text();
  const json = responseText ? safeJsonParse(responseText) : null;

  if (!response.ok) {
    const message = (json as ApiErrorResponse | null)?.error || response.statusText || 'Request failed';
    const apiError = new ApiError(message, response.status, json);
    return handleApiError(path, apiError);
  }

  if (json && typeof json === 'object' && 'success' in json) {
    const payloadJson = json as ApiEnvelope<unknown> | ApiErrorResponse;
    if (payloadJson.success === false) {
      const apiError = new ApiError(payloadJson.error ?? 'Request failed', response.status, payloadJson);
      return handleApiError(path, apiError);
    }

    if ('data' in payloadJson) {
      return payloadJson.data as T;
    }

    return payloadJson as T;
  }

  return json as T;
}

const safeJsonParse = (input: string) => {
  try {
    return JSON.parse(input);
  } catch (error) {
    console.warn('[api] Failed to parse JSON response', error);
    return null;
  }
};

// Shared API envelopes
interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error?: string;
}

// Domain types
export type LiveLifecycleStatus =
  | 'scheduled'
  | 'waiting_for_host'
  | 'live'
  | 'inactive'
  | 'ending'
  | 'ended';

export interface LiveSummary {
  id: string;
  creator_id: string;
  creator_username?: string | null;
  creator_avatar_url?: string | null;
  creator_display_name?: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  status: LiveLifecycleStatus | null;
  is_active: boolean | null;
  room_name: string | null;
  creator_percent: number | null;
  affiliate_percent: number | null;
  platform_percent: number | null;
  created_at: string | null;
  ended_at: string | null;
  thumbnail_url?: string | null;
}

export interface StartLiveResponse {
  liveId: string;
  roomName: string;
  accessUrl: string;
}

export interface LiveInfoResponse {
  liveId: string;
  title: string | null;
  status: LiveLifecycleStatus | null;
  roomName: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  creatorName?: string | null;
  isEntitled?: boolean;
  requiresPayment?: boolean;
  preview_seconds?: number;
  credit_balance?: number;
  is_blocked_for_credits?: boolean;
  credits_consumed?: number;
}

export interface LiveReconnectResponse {
  access: 'granted' | 'preview' | 'blocked';
  credits: number;
  remaining_preview_seconds: number;
  roomName?: string | null;
}

export interface LiveAccessResponse {
  liveId: string;
  accessUrl: string;
  roomName?: string | null;
  grantedAt?: string | null;
  credit_balance?: number;
  credits_consumed?: number;
}

export interface LiveHeartbeatResponse {
  status: 'OK' | 'NO_CREDITS';
  secondsWatched: number;
  creditsConsumed: number;
  creditsChargedThisTick: number;
  ranOutOfCredits: boolean;
  remainingCredits: number;
}

/** @deprecated Mercado Pago discontinued - use Velana PIX */
export interface PaymentPreferenceResponse {
  secureUrl?: string;
  paymentId?: string;
  amount?: number;
  currency?: string | null;
}

export interface AffiliateStatsResponse {
  totalEarningsCents: number;
  availableBalanceCents: number;
  totalReferrals: number;
}

export interface AffiliateHistoryEntry {
  id: string;
  createdAt: string;
  amountCents: number;
  level: number | null;
  referredUserId: string | null;
}

export interface RegistrationCheckoutPayload {
  fullName?: string;
  email?: string;
  password?: string;
  referralCode?: string | null;
  referrer_id?: string | null;
  acceptTerms?: boolean;
  free?: boolean;
  root?: boolean;
}

export interface RegistrationCheckoutResponse {
  paymentId?: string;
  transactionId?: string;
  externalRef?: string;
  secureUrl?: string;
  amount?: number;
  status?: string;
  token?: string | null;
  refresh_token?: string | null;
  profileId?: string;
  pix?: {
    qrCode: string;
    qrCodeImage?: string;
    expiresAt: string;
  };
}

export interface LiveAnalyticsSnapshot {
  liveId: string;
  current_viewers: number;
  total_unique_viewers: number;
  credits_consumed_total: number;
  credits_remaining_total: number;
  credits_remaining_average: number;
  live_duration_ms: number;
  creator_revenue_per_credit: number;
  estimated_earnings: number;
}

export interface AffiliateRegisterPayload {
  referralCode?: string | null;
}

export interface CreatorBalanceSnapshot {
  balance: number;
  total_earned: number;
  total_affiliate_earned: number;
  total_withdrawn: number;
  pending_withdrawals: number;
}

export interface CreatorReferralSnapshot {
  referral_link: { id: string; code: string; created_at: string } | null;
  conversions: Array<{
    id: string;
    referral_code: string;
    new_creator_id: string;
    commission_amount: number;
    created_at: string;
  }>;
  total_affiliate_earned: number;
}

export interface WithdrawalRecord {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at?: string | null;
}

export interface DiagnosticsSnapshot {
  success: true;
  supabase: 'ok' | 'error';
  velana: 'ok' | 'error';
  resend: 'ok' | 'error';
  env: {
    ok: boolean;
    missing: string[];
    warnings: string[];
    warningFlags: Record<string, boolean>;
  };
  migrations: { ok: boolean; missing?: string[] };
  monitor: {
    active: boolean;
    running: boolean;
    lastHeartbeatRun: string | null;
    intervalMs: number;
    managedBy?: string;
    schedule?: string;
  };
  logger: string;
  ratelimit: string;
  cors: {
    allowedOrigins: string[];
    blockedOrigins: string[];
    includesPublicBase?: boolean;
  };
  livekit: { enabled: boolean };
  publicBaseUrl: {
    url: string | null;
    source: string;
    canonicalWebhookBase: string | null;
  };
  urlConsistency: {
    canonicalBase: string | null;
    velanaWebhook: {
      expectedUrl: string | null;
      configuredUrl: string | null;
      match: boolean;
      matchesHost: boolean;
    };
    corsIncludesPublicBase: boolean;
  };
  webhook: {
    domainGuardEnabled: boolean;
    expectedDomain: string | null;
    receivedHostExample: string | null;
    lastSeenHosts: string[];
    warnings: string[];
  };
  version: string;
}

// Payload helpers
export interface LiveIdentifierPayload {
  liveId: string;
}

export interface CreatePaymentPayload {
  liveId?: string;
  userId?: string;
  price?: number;
  purchaseType?: 'live' | 'credits' | 'registration' | string;
  metadata?: Record<string, unknown>;
}

export interface SubmitWithdrawalPayload {
  amount: number;
}

export interface CreditBalanceResponse {
  creditBalance: number;
  balance?: number;
  balance_credits?: number;
  estimated_time?: number;
}

export interface CreditPurchaseResponse extends PaymentPreferenceResponse {
  credits: number;
  amount: number;
}

// Public API surface
export const apiClient = {
  fetchPublicLives: async (signal?: AbortSignal) => {
    // Fetch lives matching same criteria as sidebar for consistency
    try {
      console.debug('[api] Fetching public lives from Supabase');
      
      // Fetch ACTIVE lives (is_active = true, status = 'live') - same as sidebar
      const { data: activeLives, error: activeError } = await supabase
        .from('lives')
        .select(`
          id, 
          creator_id, 
          title, 
          description, 
          price, 
          status, 
          is_active, 
          room_name, 
          creator_percent, 
          affiliate_percent, 
          platform_percent, 
          created_at, 
          ended_at,
          thumbnail_url
        `)
        .eq('is_active', true)
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      // Also fetch recent ended lives for the "offline" section
      const { data: recentLives, error: recentError } = await supabase
        .from('lives')
        .select(`
          id, 
          creator_id, 
          title, 
          description, 
          price, 
          status, 
          is_active, 
          room_name, 
          creator_percent, 
          affiliate_percent, 
          platform_percent, 
          created_at, 
          ended_at,
          thumbnail_url
        `)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(20);

      if (activeError) {
        console.warn('[api] Active lives query failed:', activeError);
      }

      // Combine active and recent ended lives
      const allLives = [...(activeLives || []), ...(recentLives || [])];

      // Enrich with creator usernames and avatar
      const creatorIds = [...new Set(allLives.map(l => l.creator_id))];
      let profileMap = new Map<string, { username: string; avatar_url: string | null; display_name: string }>();
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', creatorIds);
        
        const { data: creatorProfiles } = await supabase
          .from('creator_profiles')
          .select('id, display_name')
          .in('id', creatorIds);
        
        const displayNameMap = new Map(creatorProfiles?.map(c => [c.id, c.display_name]) || []);
        
        profiles?.forEach(p => profileMap.set(p.id, {
          username: p.username,
          avatar_url: p.avatar_url,
          display_name: displayNameMap.get(p.id) || p.username
        }));
      }

      const enrichedLives = allLives.map(l => ({
        ...l,
        creator_username: profileMap.get(l.creator_id)?.username || null,
        creator_avatar_url: profileMap.get(l.creator_id)?.avatar_url || null,
        creator_display_name: profileMap.get(l.creator_id)?.display_name || null
      })) as LiveSummary[];

      console.debug('[api] Fetched', enrichedLives.length, 'lives (', activeLives?.length || 0, 'active,', recentLives?.length || 0, 'recent)');
      return { lives: enrichedLives };
    } catch (error) {
      console.warn('[api] Failed to fetch lives:', error);
      return { lives: [] };
    }
  },

  startLive: (payload: LiveIdentifierPayload) =>
    request<StartLiveResponse>('/lives/start', { method: 'POST', body: payload, auth: 'required' }),

  getCreatorLives: (signal?: AbortSignal) =>
    request<{ lives: LiveSummary[] }>('/lives/creator', { method: 'GET', auth: 'required', signal }),

  getLiveInfo: (liveId: string, signal?: AbortSignal) =>
    request<LiveInfoResponse>(`/lives/${liveId}/info`, { method: 'GET', auth: 'optional', signal }),

  reconnectLive: (liveId: string, signal?: AbortSignal) =>
    request<LiveReconnectResponse>(`/lives/${liveId}/reconnect`, { method: 'GET', auth: 'optional', signal }),

  getLiveAnalytics: (liveId: string) =>
    request<LiveAnalyticsSnapshot>(`/lives/${liveId}/analytics`, { method: 'GET', auth: 'required' }),

  requestLiveAccess: (payload: LiveIdentifierPayload) =>
    request<LiveAccessResponse>('/lives/access', { method: 'POST', body: payload, auth: 'required' }),

  heartbeatLive: async (liveId: string, sessionToken: string): Promise<LiveHeartbeatResponse> => {
    // Use Edge Function instead of Node.js backend for heartbeat
    const token = await resolveAccessToken();
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    const { data, error } = await supabase.functions.invoke('viewer-heartbeat', {
      body: { liveId, sessionToken },
    });

    if (error) {
      console.error('[api] viewer-heartbeat error:', error);
      throw new ApiError(error.message || 'Heartbeat failed', 500);
    }

    if (data?.error) {
      throw new ApiError(data.error, data.status || 500);
    }

    return data as LiveHeartbeatResponse;
  },

  /** @deprecated Use createCreditsPayment from supabaseApi.ts instead - Mercado Pago discontinued */
  createPaymentPreference: async (_payload: CreatePaymentPayload): Promise<PaymentPreferenceResponse> => {
    console.warn('[api] createPaymentPreference deprecated - use Velana PIX via supabaseApi.ts');
    throw new ApiError('Mercado Pago discontinued. Use PIX via Velana.', 410);
  },

  getCreatorBalance: () =>
    request<CreatorBalanceSnapshot>('/creators/balance', { method: 'GET', auth: 'required' }),

  getCreatorReferrals: () =>
    request<CreatorReferralSnapshot>('/creators/referrals', { method: 'GET', auth: 'required' }),

  getAffiliateStats: fetchAffiliateStats,

  getAffiliateHistory: fetchAffiliateHistory,

  getReferralLink: fetchReferralLink,

  getAffiliateCode: () =>
    request<{ code: string }>('/affiliates/code', { method: 'GET', auth: 'required' }),

  updateAffiliateCode: (code: string) =>
    request<{ code: string }>('/affiliates/code', {
      method: 'POST',
      auth: 'required',
      body: { code },
    }),

  validateAffiliateCode: (code: string) =>
    request<{ valid: boolean; ownerId: string | null }>(
      `/affiliates/validate?code=${encodeURIComponent(code)}`,
      { method: 'GET', auth: 'optional' },
    ),

  submitWithdrawal: (payload: SubmitWithdrawalPayload) =>
    request<{ withdrawal: WithdrawalRecord }>('/creators/withdraw', {
      method: 'POST',
      body: payload,
      auth: 'required',
    }),

  registerAffiliate: (payload: AffiliateRegisterPayload) =>
    request<PaymentPreferenceResponse>('/affiliates/register', {
      method: 'POST',
      body: payload,
      auth: 'required',
    }),

  registrationCheckout: (payload: RegistrationCheckoutPayload) =>
    request<RegistrationCheckoutResponse>('/registration/checkout', {
      method: 'POST',
      body: payload,
      auth: 'optional',
    }),

  resolveUsername: (username: string) => resolveUsernameToEmail(username),

  /** @deprecated Use createRegistrationPayment from supabaseApi.ts instead - Mercado Pago discontinued */
  createRegistrationPreference: async (_payload: { userId: string; parentId: string }): Promise<PaymentPreferenceResponse> => {
    console.warn('[api] createRegistrationPreference deprecated - use Velana PIX via supabaseApi.ts');
    throw new ApiError('Mercado Pago discontinued. Use PIX via Velana.', 410);
  },

  getCreditBalance: async () => {
    const data = await withFallback(
      () => request<CreditBalanceResponse>('/credits/balance', { auth: 'required' }),
      async () => ({
        balance: 0,
        balance_credits: 0,
        creditBalance: 0,
        estimated_time: 0,
      }),
    );
    const balance = data?.balance_credits ?? data?.balance ?? data?.creditBalance ?? 0;
    const estimated = data?.estimated_time ?? Math.max(0, Math.floor(balance / 6));

    return {
      creditBalance: balance,
      balance,
      balance_credits: balance,
      estimated_time: estimated,
    };
  },

  /** @deprecated Use createCreditsPayment from supabaseApi.ts instead - Mercado Pago discontinued */
  purchaseCredits: async (_payload: { userId: string; price: number; credits?: number; liveId?: string }): Promise<PaymentPreferenceResponse> => {
    console.warn('[api] purchaseCredits deprecated - use createCreditsPayment from supabaseApi.ts');
    throw new ApiError('Mercado Pago discontinued. Use PIX via Velana.', 410);
  },

  consumeCredits: async (_amount: number) => {
    console.warn('[api] consumeCredits not implemented; backend endpoint missing');
    throw new ApiError('Credit consumption is not available yet', 501);
  },

  fetchDiagnostics: () =>
    request<DiagnosticsSnapshot>('/status/diagnostics', { method: 'GET', auth: 'optional' }),
};

export type ApiClient = typeof apiClient;

export const api = {
  lives: {
    getPublic: apiClient.fetchPublicLives,
    getCreatorLive: async (signal?: AbortSignal) => {
      const result = await apiClient.getCreatorLives(signal);
      return result.lives?.[0] ?? null;
    },
    listCreatorLives: apiClient.getCreatorLives,
    start: apiClient.startLive,
    getInfo: (liveId: string, signal?: AbortSignal) => apiClient.getLiveInfo(liveId, signal),
    access: (liveId: string) => apiClient.requestLiveAccess({ liveId }),
    reconnect: (liveId: string, signal?: AbortSignal) => apiClient.reconnectLive(liveId, signal),
    analytics: (liveId: string) => apiClient.getLiveAnalytics(liveId),
    heartbeat: (liveId: string, sessionToken: string) => apiClient.heartbeatLive(liveId, sessionToken),
  },
  payments: {
    create: (payload: CreatePaymentPayload) => apiClient.createPaymentPreference(payload),
  },
  credits: {
    balance: apiClient.getCreditBalance,
    purchase: apiClient.purchaseCredits,
    consume: apiClient.consumeCredits,
  },
  creators: {
    balance: apiClient.getCreatorBalance,
    referrals: apiClient.getCreatorReferrals,
    withdraw: apiClient.submitWithdrawal,
  },
  affiliates: {
    register: apiClient.registerAffiliate,
    stats: apiClient.getAffiliateStats,
    history: apiClient.getAffiliateHistory,
    referralLink: apiClient.getReferralLink,
    code: apiClient.getAffiliateCode,
    saveCode: apiClient.updateAffiliateCode,
    validateCode: apiClient.validateAffiliateCode,
  },
  registration: {
    checkout: apiClient.registrationCheckout,
    createPreference: apiClient.createRegistrationPreference,
  },
  auth: {
    resolveUsername: apiClient.resolveUsername,
  },
  status: {
    diagnostics: apiClient.fetchDiagnostics,
  },
};

export type Api = typeof api;

/**
 * Example React Query usage:
 *
 * const query = useQuery({
 *   queryKey: ['lives', 'public'],
 *   queryFn: () => apiClient.fetchPublicLives(),
 * });
 *
 * Example direct hook without React Query:
 *
 * export function useCreatorLives() {
 *   const [state, setState] = useState<{ lives: LiveSummary[] } | null>(null);
 *   const [error, setError] = useState<string | null>(null);
 *
 *   useEffect(() => {
 *     let mounted = true;
 *     apiClient
 *       .getCreatorLives()
 *       .then((data) => {
 *         if (mounted) setState(data);
 *       })
 *       .catch((err) => {
 *         if (mounted) setError(err instanceof ApiError ? err.message : 'Failed to load lives');
 *       });
 *     return () => {
 *       mounted = false;
 *     };
 *   }, []);
 *
 *   return { state, error };
 * }
 */
