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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          event_name: string
          event_properties: Json | null
          id: string
          page_url: string | null
          user_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_name: string
          event_properties?: Json | null
          id?: string
          page_url?: string | null
          user_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          event_name?: string
          event_properties?: Json | null
          id?: string
          page_url?: string | null
          user_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          location: string | null
          social_links: Json | null
          updated_at: string
          user_address: string
          user_id: string | null
          username: string | null
          visibility: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          social_links?: Json | null
          updated_at?: string
          user_address: string
          user_id?: string | null
          username?: string | null
          visibility?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          social_links?: Json | null
          updated_at?: string
          user_address?: string
          user_id?: string | null
          username?: string | null
          visibility?: string
          website?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          setting_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          setting_value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          setting_value?: string
        }
        Relationships: []
      }
      social_stats_cache: {
        Row: {
          followers_count: number | null
          following_count: number | null
          last_updated: string | null
          likes_count: number | null
          posts_count: number | null
          shares_count: number | null
          user_address: string
        }
        Insert: {
          followers_count?: number | null
          following_count?: number | null
          last_updated?: string | null
          likes_count?: number | null
          posts_count?: number | null
          shares_count?: number | null
          user_address: string
        }
        Update: {
          followers_count?: number | null
          following_count?: number | null
          last_updated?: string | null
          likes_count?: number | null
          posts_count?: number | null
          shares_count?: number | null
          user_address?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_verification_audit: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      wallet_verifications: {
        Row: {
          attempt_count: number | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          last_attempt_at: string | null
          locked_until: string | null
          nonce: string
          nonce_hash: string | null
          user_agent: string | null
          user_id: string
          verified: boolean
          wallet_address: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_attempt_at?: string | null
          locked_until?: string | null
          nonce: string
          nonce_hash?: string | null
          user_agent?: string | null
          user_id: string
          verified?: boolean
          wallet_address: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_attempt_at?: string | null
          locked_until?: string | null
          nonce?: string
          nonce_hash?: string | null
          user_agent?: string | null
          user_id?: string
          verified?: boolean
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_analytics_data: {
        Args: { older_than_days?: number }
        Returns: number
      }
      anonymize_old_analytics_data: {
        Args: { older_than_days?: number }
        Returns: number
      }
      cleanup_expired_verifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_wallet_verifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      complete_wallet_verification: {
        Args: {
          p_ip_address?: string
          p_signature: string
          p_verification_id: string
        }
        Returns: {
          message: string
          profile_id: string
          success: boolean
        }[]
      }
      create_profile_with_wallet: {
        Args: { profile_data?: Json; wallet_address: string }
        Returns: string
      }
      create_secure_verification: {
        Args: {
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
          p_wallet_address: string
        }
        Returns: {
          expires_at: string
          message: string
          nonce: string
          verification_id: string
        }[]
      }
      get_analytics_security_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          events_anonymized: number
          events_with_pii: number
          oldest_event_date: string
          retention_compliance: boolean
          total_events: number
        }[]
      }
      get_analytics_summary: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          date: string
          event_count: number
          event_name: string
          unique_users: number
        }[]
      }
      get_own_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          banner_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          location: string
          social_links: Json
          updated_at: string
          user_address: string
          user_id: string
          username: string
          visibility: string
          website: string
        }[]
      }
      get_public_profile: {
        Args: { profile_user_address: string }
        Returns: {
          avatar_url: string
          banner_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          location: string
          social_links: Json
          updated_at: string
          user_address: string
          username: string
          visibility: string
          website: string
        }[]
      }
      get_public_profile_safe: {
        Args: { profile_user_address: string }
        Returns: {
          avatar_url: string
          banner_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          location: string
          social_links: Json
          updated_at: string
          username: string
          visibility: string
          website: string
        }[]
      }
      get_public_profiles: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          username: string
          visibility: string
        }[]
      }
      get_public_profiles_secure: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          username: string
          visibility: string
        }[]
      }
      get_public_social_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          followers_count: number
          following_count: number
          last_updated: string
          likes_count: number
          posts_count: number
          shares_count: number
          user_address_hash: string
        }[]
      }
      get_social_stats_by_profile: {
        Args: { profile_id: string }
        Returns: {
          followers_count: number
          following_count: number
          last_updated: string
          likes_count: number
          posts_count: number
          shares_count: number
        }[]
      }
      get_user_analytics_summary: {
        Args: { days_back?: number }
        Returns: {
          event_count: number
          event_name: string
          first_seen: string
          last_seen: string
        }[]
      }
      get_verification_security_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_verifications: number
          expired_unverified: number
          locked_accounts: number
          old_audit_logs: number
          verified_with_sensitive_data: number
        }[]
      }
      get_verification_status: {
        Args: { p_wallet_address: string }
        Returns: {
          can_request_new: boolean
          has_pending_verification: boolean
          is_locked: boolean
          locked_until: string
        }[]
      }
      get_verification_status_safe: {
        Args: { target_user_id?: string }
        Returns: {
          attempt_count: number
          created_at: string
          expires_at: string
          has_active_verification: boolean
          id: string
          is_locked: boolean
          locked_until_safe: string
          user_id: string
          verified: boolean
          wallet_address: string
        }[]
      }
      get_verification_status_secure: {
        Args: { p_wallet_address: string }
        Returns: {
          can_request_new: boolean
          expires_at: string
          has_pending_verification: boolean
          is_locked: boolean
          locked_until: string
        }[]
      }
      get_wallet_verification_status: {
        Args: { p_wallet_address?: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          is_locked: boolean
          locked_until_public: string
          user_id: string
          verified: boolean
          wallet_address: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      link_wallet_to_user: {
        Args: { wallet_address: string }
        Returns: string
      }
      log_wallet_verification_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
          p_wallet_address: string
        }
        Returns: undefined
      }
      schedule_analytics_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      secure_analytics_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      secure_cleanup_wallet_verifications: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      security_reminder: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_social_stats_cache: {
        Args: { target_address: string }
        Returns: undefined
      }
      user_owns_verification: {
        Args: { verification_user_id: string }
        Returns: boolean
      }
      validate_verification_attempt: {
        Args: {
          p_ip_address?: string
          p_nonce: string
          p_user_id: string
          p_wallet_address: string
        }
        Returns: {
          error_message: string
          is_valid: boolean
          verification_id: string
        }[]
      }
      verification_security_reminder: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
