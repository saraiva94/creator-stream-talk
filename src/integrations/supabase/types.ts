export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      creators: {
        Row: {
          id: string;
          user_id: string;
          bio: string | null;
          price_per_minute: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bio?: string | null;
          price_per_minute?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bio?: string | null;
          price_per_minute?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'creators_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lives: {
        Row: {
          id: string;
          creator_id: string;
          title: string | null;
          description: string | null;
          price: number | null;
          room_name: string | null;
          is_active: boolean | null;
          status: string | null;
          creator_percent: number | null;
          affiliate_percent: number | null;
          platform_percent: number | null;
          created_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title?: string | null;
          description?: string | null;
          price?: number | null;
          room_name?: string | null;
          is_active?: boolean | null;
          status?: string | null;
          creator_percent?: number | null;
          affiliate_percent?: number | null;
          platform_percent?: number | null;
          created_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string | null;
          description?: string | null;
          price?: number | null;
          room_name?: string | null;
          is_active?: boolean | null;
          status?: string | null;
          creator_percent?: number | null;
          affiliate_percent?: number | null;
          platform_percent?: number | null;
          created_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lives_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          live_id: string;
          amount: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          live_id: string;
          amount: number;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          live_id?: string;
          amount?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_live_id_fkey';
            columns: ['live_id'];
            referencedRelation: 'lives';
            referencedColumns: ['id'];
          },
        ];
      };
      live_access: {
        Row: {
          id: string;
          user_id: string;
          live_id: string;
          granted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          live_id: string;
          granted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          live_id?: string;
          granted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_access_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_access_live_id_fkey';
            columns: ['live_id'];
            referencedRelation: 'lives';
            referencedColumns: ['id'];
          },
        ];
      };
      commissions: {
        Row: {
          id: string;
          creator_id: string;
          payment_id: string;
          commission_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          payment_id: string;
          commission_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          payment_id?: string;
          commission_amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commissions_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commissions_payment_id_fkey';
            columns: ['payment_id'];
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_links: {
        Row: {
          id: string;
          creator_id: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          code?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_links_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_conversions: {
        Row: {
          id: string;
          referral_code: string;
          parent_creator_id: string;
          new_creator_id: string;
          commission_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_code: string;
          parent_creator_id: string;
          new_creator_id: string;
          commission_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_code?: string;
          parent_creator_id?: string;
          new_creator_id?: string;
          commission_amount?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_conversions_parent_creator_id_fkey';
            columns: ['parent_creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_conversions_new_creator_id_fkey';
            columns: ['new_creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      creator_balance: {
        Row: {
          id: string;
          creator_id: string;
          balance: number;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          balance?: number;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          creator_id?: string;
          balance?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'creator_balance_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      affiliate_balance: {
        Row: {
          id: string;
          creator_id: string;
          balance: number;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          balance?: number;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          creator_id?: string;
          balance?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'affiliate_balance_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      withdrawals: {
        Row: {
          id: string;
          creator_id: string;
          amount: number;
          status: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          amount: number;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          creator_id?: string;
          amount?: number;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'withdrawals_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      withdrawal_audit_log: {
        Row: {
          id: string;
          withdrawal_id: string;
          status: string;
          admin_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          withdrawal_id: string;
          status: string;
          admin_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          withdrawal_id?: string;
          status?: string;
          admin_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'withdrawal_audit_log_withdrawal_id_fkey';
            columns: ['withdrawal_id'];
            referencedRelation: 'withdrawals';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_revenue: {
        Row: {
          id: string;
          payment_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_revenue_payment_id_fkey';
            columns: ['payment_id'];
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_events: {
        Row: {
          idempotency_key: string;
          body_hash: string | null;
          processed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          idempotency_key: string;
          body_hash?: string | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          idempotency_key?: string;
          body_hash?: string | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      live_heartbeat: {
        Row: {
          id: string;
          live_id: string;
          creator_id: string;
          last_heartbeat: string;
          camera_active: boolean;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          live_id: string;
          creator_id: string;
          last_heartbeat: string;
          camera_active?: boolean;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          live_id?: string;
          creator_id?: string;
          last_heartbeat?: string;
          camera_active?: boolean;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'live_heartbeat_live_id_fkey';
            columns: ['live_id'];
            referencedRelation: 'lives';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_heartbeat_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
      live_end_log: {
        Row: {
          id: string;
          live_id: string;
          creator_id: string;
          reason: string | null;
          ended_at: string;
        };
        Insert: {
          id?: string;
          live_id: string;
          creator_id: string;
          reason?: string | null;
          ended_at?: string;
        };
        Update: {
          id?: string;
          live_id?: string;
          creator_id?: string;
          reason?: string | null;
          ended_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_end_log_live_id_fkey';
            columns: ['live_id'];
            referencedRelation: 'lives';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_end_log_creator_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
