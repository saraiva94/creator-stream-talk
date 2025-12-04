export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Minimal type definitions for backend services
export type Database = {
  public: {
    Tables: {
      live_consumption: {
        Row: LiveConsumptionRow;
        Insert: Partial<LiveConsumptionRow>;
        Update: Partial<LiveConsumptionRow>;
      };
      credits_wallet: {
        Row: CreditsWalletRow;
        Insert: Partial<CreditsWalletRow>;
        Update: Partial<CreditsWalletRow>;
      };
      lives: {
        Row: LiveRow;
        Insert: Partial<LiveRow>;
        Update: Partial<LiveRow>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
      };
      credit_purchases: {
        Row: CreditPurchaseRow;
        Insert: Partial<CreditPurchaseRow>;
        Update: Partial<CreditPurchaseRow>;
      };
      creator_wallet: {
        Row: CreatorWalletRow;
        Insert: Partial<CreatorWalletRow>;
        Update: Partial<CreatorWalletRow>;
      };
      creator_earnings: {
        Row: CreatorEarningsRow;
        Insert: Partial<CreatorEarningsRow>;
        Update: Partial<CreatorEarningsRow>;
      };
      registration_referrals: {
        Row: RegistrationReferralRow;
        Insert: Partial<RegistrationReferralRow>;
        Update: Partial<RegistrationReferralRow>;
      };
      affiliate_logs: {
        Row: AffiliateLogRow;
        Insert: Partial<AffiliateLogRow>;
        Update: Partial<AffiliateLogRow>;
      };
      webhook_events: {
        Row: WebhookEventRow;
        Insert: Partial<WebhookEventRow>;
        Update: Partial<WebhookEventRow>;
      };
      live_access: {
        Row: LiveAccessRow;
        Insert: Partial<LiveAccessRow>;
        Update: Partial<LiveAccessRow>;
      };
    };
  };
};

export type LiveConsumptionRow = {
  id: string;
  live_id: string;
  user_id: string;
  session_token: string | null;
  seconds_watched: number;
  credits_consumed: number;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string | null;
};

export type CreditsWalletRow = {
  id: string;
  user_id: string;
  profile_id: string | null;
  balance_credits: number;
  created_at: string | null;
  updated_at: string | null;
};

export type LiveRow = {
  id: string;
  creator_id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  is_active: boolean;
  room_name: string | null;
  price: number | null;
  creator_percent: number | null;
  affiliate_percent: number | null;
  platform_percent: number | null;
  created_at: string;
  ended_at: string | null;
};

export type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  balance: number;
  referral_code: string | null;
  referred_by: string | null;
  referrer_direct: string | null;
  referrer_root: string | null;
  referrer_id: string | null;
  referrer_parent_id: string | null;
  is_root_creator: boolean;
  affiliate_earnings: number;
  status: string;
  language: string | null;
  bio: string | null;
  website: string | null;
  gender: string | null;
  is_subscribed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type CreditPurchaseRow = {
  id: string;
  profile_id: string;
  credits: number;
  amount_cents: number;
  payment_id: string;
  status: string;
  created_at: string;
};

export type CreatorWalletRow = {
  id: string;
  creator_id: string;
  balance_cents: number;
  pending_cents: number;
  total_earned_cents: number;
  created_at: string;
  updated_at: string;
};

export type CreatorEarningsRow = {
  id: string;
  live_id: string;
  creator_id: string;
  credits_consumed: number;
  gross_amount_cents: number;
  creator_amount_cents: number;
  platform_amount_cents: number;
  status: string;
  settled_at: string | null;
  created_at: string;
};

export type RegistrationReferralRow = {
  id: string;
  payment_id: string;
  user_id: string;
  email: string | null;
  referrer_id: string | null;
  referrer_parent_id: string | null;
  is_root_creator: boolean;
  is_free: boolean;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type AffiliateLogRow = {
  id: string;
  new_user: string | null;
  direct_referrer: string | null;
  root_creator: string | null;
  amount_direct: number;
  amount_root: number;
  amount_platform: number;
  event_type: string;
  payment_id: string | null;
  created_at: string;
};

export type WebhookEventRow = {
  id: string;
  idempotency_key: string;
  created_at: string;
};

export type LiveAccessRow = {
  id: string;
  live_id: string;
  user_id: string;
  status: string;
  granted_at: string | null;
};

export type Tables<TableName extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][TableName]['Row'];
