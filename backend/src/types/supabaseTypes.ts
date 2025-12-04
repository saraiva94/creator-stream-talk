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
    };
  };
};

export type LiveConsumptionRow = {
  id: string;
  live_id: string;
  user_id: string;
  session_token: string;
  seconds_watched: number;
  credits_consumed: number;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string | null;
};

export type CreditsWalletRow = {
  profile_id: string;
  balance_credits: number;
  updated_at: string;
};

export type LiveRow = {
  id: string;
  creator_id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  is_active: boolean;
  room_name: string | null;
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
  created_at: string;
  updated_at: string;
};

export type Tables<TableName extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][TableName]['Row'];
