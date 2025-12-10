export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      affiliate_logs: {
        Row: {
          amount_direct: number | null
          amount_platform: number | null
          amount_root: number | null
          created_at: string | null
          direct_referrer: string | null
          event_type: string
          id: string
          new_user: string | null
          payment_id: string | null
          root_creator: string | null
        }
        Insert: {
          amount_direct?: number | null
          amount_platform?: number | null
          amount_root?: number | null
          created_at?: string | null
          direct_referrer?: string | null
          event_type: string
          id?: string
          new_user?: string | null
          payment_id?: string | null
          root_creator?: string | null
        }
        Update: {
          amount_direct?: number | null
          amount_platform?: number | null
          amount_root?: number | null
          created_at?: string | null
          direct_referrer?: string | null
          event_type?: string
          id?: string
          new_user?: string | null
          payment_id?: string | null
          root_creator?: string | null
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean | null
          reason: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          reason?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_users_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_users_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_users_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          banned_words: string[] | null
          id: string
          room_id: string
          slow_mode_duration: number | null
          slow_mode_enabled: boolean | null
          subscribers_only: boolean | null
          updated_at: string
        }
        Insert: {
          banned_words?: string[] | null
          id?: string
          room_id: string
          slow_mode_duration?: number | null
          slow_mode_enabled?: boolean | null
          subscribers_only?: boolean | null
          updated_at?: string
        }
        Update: {
          banned_words?: string[] | null
          id?: string
          room_id?: string
          slow_mode_duration?: number | null
          slow_mode_enabled?: boolean | null
          subscribers_only?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_settings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_settings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          commission_amount: number | null
          created_at: string | null
          creator_id: string
          id: string
          payment_id: string | null
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string | null
          creator_id: string
          id?: string
          payment_id?: string | null
        }
        Update: {
          commission_amount?: number | null
          created_at?: string | null
          creator_id?: string
          id?: string
          payment_id?: string | null
        }
        Relationships: []
      }
      creator_balance: {
        Row: {
          balance: number | null
          creator_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          creator_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          creator_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          creator_id: string
          document_number: string
          id: string
          is_active: boolean | null
          routing_number: string
          updated_at: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type: string
          bank_name: string
          created_at?: string
          creator_id: string
          document_number: string
          id?: string
          is_active?: boolean | null
          routing_number: string
          updated_at?: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          creator_id?: string
          document_number?: string
          id?: string
          is_active?: boolean | null
          routing_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_earnings: {
        Row: {
          created_at: string | null
          creator_amount_cents: number | null
          creator_id: string
          credits_consumed: number | null
          gross_amount_cents: number | null
          id: string
          live_id: string
          platform_amount_cents: number | null
          settled_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          creator_amount_cents?: number | null
          creator_id: string
          credits_consumed?: number | null
          gross_amount_cents?: number | null
          id?: string
          live_id: string
          platform_amount_cents?: number | null
          settled_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          creator_amount_cents?: number | null
          creator_id?: string
          credits_consumed?: number | null
          gross_amount_cents?: number | null
          id?: string
          live_id?: string
          platform_amount_cents?: number | null
          settled_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          approved_for_live: boolean | null
          bio: string | null
          created_at: string
          daily_room_name: string | null
          daily_room_url: string | null
          display_name: string
          id: string
          is_streaming: boolean | null
          tags: string[] | null
          viewer_count: number | null
        }
        Insert: {
          approved_for_live?: boolean | null
          bio?: string | null
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          display_name: string
          id: string
          is_streaming?: boolean | null
          tags?: string[] | null
          viewer_count?: number | null
        }
        Update: {
          approved_for_live?: boolean | null
          bio?: string | null
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          display_name?: string
          id?: string
          is_streaming?: boolean | null
          tags?: string[] | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_wallet: {
        Row: {
          balance_cents: number | null
          created_at: string | null
          creator_id: string
          id: string
          pending_cents: number | null
          total_earned_cents: number | null
          updated_at: string | null
        }
        Insert: {
          balance_cents?: number | null
          created_at?: string | null
          creator_id: string
          id?: string
          pending_cents?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          balance_cents?: number | null
          created_at?: string | null
          creator_id?: string
          id?: string
          pending_cents?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      creators: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_approved: boolean | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string | null
          credits: number
          id: string
          payment_id: string
          profile_id: string
          status: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          credits: number
          id?: string
          payment_id: string
          profile_id: string
          status?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          credits?: number
          id?: string
          payment_id?: string
          profile_id?: string
          status?: string | null
        }
        Relationships: []
      }
      credits_wallet: {
        Row: {
          balance_credits: number
          created_at: string | null
          id: string
          profile_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance_credits?: number
          created_at?: string | null
          id?: string
          profile_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance_credits?: number
          created_at?: string | null
          id?: string
          profile_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          created_at: string | null
          email_type: string
          error: string | null
          html_content: string
          id: string
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error?: string | null
          html_content: string
          id?: string
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error?: string | null
          html_content?: string
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      financial_settings: {
        Row: {
          affiliate_percentage: number
          creator_percentage: number
          id: string
          platform_percentage: number
          subscription_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          affiliate_percentage?: number
          creator_percentage?: number
          id?: string
          platform_percentage?: number
          subscription_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          affiliate_percentage?: number
          creator_percentage?: number
          id?: string
          platform_percentage?: number
          subscription_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      live_access: {
        Row: {
          granted_at: string | null
          id: string
          live_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          id?: string
          live_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string | null
          id?: string
          live_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_consumption: {
        Row: {
          credits_consumed: number | null
          ended_at: string | null
          id: string
          last_heartbeat_at: string | null
          live_id: string
          seconds_watched: number | null
          session_token: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          credits_consumed?: number | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          live_id: string
          seconds_watched?: number | null
          session_token?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          credits_consumed?: number | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          live_id?: string
          seconds_watched?: number | null
          session_token?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lives: {
        Row: {
          affiliate_percent: number | null
          created_at: string | null
          creator_id: string
          creator_percent: number | null
          description: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          platform_percent: number | null
          price: number | null
          room_name: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          affiliate_percent?: number | null
          created_at?: string | null
          creator_id: string
          creator_percent?: number | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          platform_percent?: number | null
          price?: number | null
          room_name?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          affiliate_percent?: number | null
          created_at?: string | null
          creator_id?: string
          creator_percent?: number | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          platform_percent?: number | null
          price?: number | null
          room_name?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lives_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          duration: number | null
          file_url: string | null
          id: string
          room_id: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          duration?: number | null
          file_url?: string | null
          id?: string
          room_id: string
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          duration?: number | null
          file_url?: string | null
          id?: string
          room_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          external_id: string | null
          id: string
          live_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          external_id?: string | null
          id?: string
          live_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          external_id?: string | null
          id?: string
          live_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          created_at: string
          creator_id: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          psp_response: Json | null
          psp_transaction_id: string | null
          source_type: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          creator_id: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          psp_response?: Json | null
          psp_transaction_id?: string | null
          source_type?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          creator_id?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          psp_response?: Json | null
          psp_transaction_id?: string | null
          source_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "creator_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_earnings: number | null
          avatar_url: string | null
          balance: number | null
          bio: string | null
          blocked_reason: string | null
          created_at: string
          facebook_handle: string | null
          gender: string | null
          id: string
          instagram_handle: string | null
          is_root_creator: boolean | null
          is_subscribed: boolean | null
          kwai_handle: string | null
          language: string | null
          referral_code: string | null
          referred_by: string | null
          referrer_direct: string | null
          referrer_id: string | null
          referrer_parent_id: string | null
          referrer_root: string | null
          status: string | null
          tiktok_handle: string | null
          twitter_handle: string | null
          updated_at: string
          username: string
          website: string | null
          youtube_handle: string | null
        }
        Insert: {
          affiliate_earnings?: number | null
          avatar_url?: string | null
          balance?: number | null
          bio?: string | null
          blocked_reason?: string | null
          created_at?: string
          facebook_handle?: string | null
          gender?: string | null
          id: string
          instagram_handle?: string | null
          is_root_creator?: boolean | null
          is_subscribed?: boolean | null
          kwai_handle?: string | null
          language?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referrer_direct?: string | null
          referrer_id?: string | null
          referrer_parent_id?: string | null
          referrer_root?: string | null
          status?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          updated_at?: string
          username: string
          website?: string | null
          youtube_handle?: string | null
        }
        Update: {
          affiliate_earnings?: number | null
          avatar_url?: string | null
          balance?: number | null
          bio?: string | null
          blocked_reason?: string | null
          created_at?: string
          facebook_handle?: string | null
          gender?: string | null
          id?: string
          instagram_handle?: string | null
          is_root_creator?: boolean | null
          is_subscribed?: boolean | null
          kwai_handle?: string | null
          language?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referrer_direct?: string | null
          referrer_id?: string | null
          referrer_parent_id?: string | null
          referrer_root?: string | null
          status?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          updated_at?: string
          username?: string
          website?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      promotional_videos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          position: number
          redirect_url: string | null
          starts_at: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          position?: number
          redirect_url?: string | null
          starts_at?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          position?: number
          redirect_url?: string | null
          starts_at?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          commission_earned: number | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          commission_earned?: number | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          commission_earned?: number | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      registration_referrals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string | null
          id: string
          is_free: boolean | null
          is_root_creator: boolean | null
          payment_id: string
          referrer_id: string | null
          referrer_parent_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_free?: boolean | null
          is_root_creator?: boolean | null
          payment_id: string
          referrer_id?: string | null
          referrer_parent_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_free?: boolean | null
          is_root_creator?: boolean | null
          payment_id?: string
          referrer_id?: string | null
          referrer_parent_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          creator_id: string
          daily_room_name: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          stream_key: string | null
          title: string
          viewer_count: number | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          stream_key?: string | null
          title: string
          viewer_count?: number | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          stream_key?: string | null
          title?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          creator_id: string
          expires_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          creator_id: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          creator_id?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      superchats: {
        Row: {
          amount: number
          created_at: string
          creator_id: string
          displayed_at: string | null
          duration_seconds: number
          expires_at: string | null
          id: string
          message: string
          payment_id: string | null
          room_id: string
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          creator_id: string
          displayed_at?: string | null
          duration_seconds: number
          expires_at?: string | null
          id?: string
          message: string
          payment_id?: string | null
          room_id: string
          status?: string
          tier: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string
          displayed_at?: string | null
          duration_seconds?: number
          expires_at?: string | null
          id?: string
          message?: string
          payment_id?: string | null
          room_id?: string
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "superchats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "superchats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "superchats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          affiliate_amount: number | null
          affiliate_id: string | null
          amount: number
          created_at: string
          creator_amount: number | null
          creator_id: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          platform_amount: number | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          affiliate_amount?: number | null
          affiliate_id?: string | null
          amount: number
          created_at?: string
          creator_amount?: number | null
          creator_id?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          platform_amount?: number | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          affiliate_amount?: number | null
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          creator_amount?: number | null
          creator_id?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          platform_amount?: number | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          type: string
          wallet_id: string
          wallet_type: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
          wallet_id: string
          wallet_type: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          wallet_id?: string
          wallet_type?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          id: string
          idempotency_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          idempotency_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          idempotency_key?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          retry_count: number | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      affiliate_transaction_summary: {
        Row: {
          affiliate_amount: number | null
          affiliate_id: string | null
          created_at: string | null
          id: string | null
          status: string | null
        }
        Insert: {
          affiliate_amount?: number | null
          affiliate_id?: string | null
          created_at?: string | null
          id?: string | null
          status?: string | null
        }
        Update: {
          affiliate_amount?: number | null
          affiliate_id?: string | null
          created_at?: string | null
          id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      email_queue_summary: {
        Row: {
          created_at: string | null
          email_type: string | null
          id: string | null
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type?: string | null
          id?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string | null
          id?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      live_consumption_safe: {
        Row: {
          credits_consumed: number | null
          ended_at: string | null
          id: string | null
          last_heartbeat_at: string | null
          live_id: string | null
          seconds_watched: number | null
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          credits_consumed?: number | null
          ended_at?: string | null
          id?: string | null
          last_heartbeat_at?: string | null
          live_id?: string | null
          seconds_watched?: number | null
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          credits_consumed?: number | null
          ended_at?: string | null
          id?: string | null
          last_heartbeat_at?: string | null
          live_id?: string | null
          seconds_watched?: number | null
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lives_public: {
        Row: {
          created_at: string | null
          creator_id: string | null
          description: string | null
          ended_at: string | null
          id: string | null
          is_active: boolean | null
          price: number | null
          room_name: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          price?: number | null
          room_name?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          price?: number | null
          room_name?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lives_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          facebook_handle: string | null
          id: string | null
          instagram_handle: string | null
          is_subscribed: boolean | null
          kwai_handle: string | null
          tiktok_handle: string | null
          twitter_handle: string | null
          username: string | null
          website: string | null
          youtube_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_handle?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_subscribed?: boolean | null
          kwai_handle?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          username?: string | null
          website?: string | null
          youtube_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_handle?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_subscribed?: boolean | null
          kwai_handle?: string | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          username?: string | null
          website?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      registration_referrals_safe: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string | null
          is_free: boolean | null
          is_root_creator: boolean | null
          payment_id: string | null
          referrer_id: string | null
          referrer_parent_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          is_free?: boolean | null
          is_root_creator?: boolean | null
          payment_id?: string | null
          referrer_id?: string | null
          referrer_parent_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          is_free?: boolean | null
          is_root_creator?: boolean | null
          payment_id?: string | null
          referrer_id?: string | null
          referrer_parent_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rooms_public: {
        Row: {
          created_at: string | null
          creator_id: string | null
          daily_room_name: string | null
          ended_at: string | null
          id: string | null
          is_active: boolean | null
          title: string | null
          viewer_count: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          viewer_count?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms_safe: {
        Row: {
          created_at: string | null
          creator_id: string | null
          daily_room_name: string | null
          ended_at: string | null
          id: string | null
          is_active: boolean | null
          title: string | null
          viewer_count: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          viewer_count?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          daily_room_name?: string | null
          ended_at?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_or_create_creator_wallet: {
        Args: { p_creator_id: string }
        Returns: {
          balance_cents: number | null
          created_at: string | null
          creator_id: string
          id: string
          pending_cents: number | null
          total_earned_cents: number | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "creator_wallet"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_affiliate_earnings: {
        Args: { p_amount_cents: number; p_profile_id: string }
        Returns: undefined
      }
      increment_balance: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      increment_creator_wallet: {
        Args: { p_amount_cents: number; p_creator_id: string }
        Returns: undefined
      }
      is_subscribed_to_creator: {
        Args: { _creator_id: string; _user_id: string }
        Returns: boolean
      }
      validate_referral_code: { Args: { p_code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "creator" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "creator", "viewer"],
    },
  },
} as const
