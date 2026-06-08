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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      application_tracker: {
        Row: {
          applied_at: string | null
          id: string
          notes: string | null
          opportunity_id: string
          saved_at: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          applied_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          saved_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          applied_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          saved_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_tracker_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_tracker_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          id: string
          metadata: Json | null
          performed_at: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          id?: string
          metadata?: Json | null
          performed_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          id?: string
          metadata?: Json | null
          performed_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          careers_url: string | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          careers_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          careers_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_opportunity_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_opportunity_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_opportunity_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_opportunity_id_fkey"
            columns: ["related_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          apply_url: string
          category: string
          company_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          experience_level: string | null
          id: string
          is_paid: boolean | null
          last_verified_at: string | null
          location: string | null
          mode: string | null
          posted_at: string
          recruiter_avatar_url: string | null
          recruiter_name: string | null
          recruiter_role: string | null
          report_count: number
          responsibilities: string[] | null
          skills: string[] | null
          source_type: string | null
          status: string
          submitted_by: string | null
          title: string
          trust_score: number | null
          updated_at: string
        }
        Insert: {
          apply_url: string
          category: string
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          experience_level?: string | null
          id?: string
          is_paid?: boolean | null
          last_verified_at?: string | null
          location?: string | null
          mode?: string | null
          posted_at?: string
          recruiter_avatar_url?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          report_count?: number
          responsibilities?: string[] | null
          skills?: string[] | null
          source_type?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          trust_score?: number | null
          updated_at?: string
        }
        Update: {
          apply_url?: string
          category?: string
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          experience_level?: string | null
          id?: string
          is_paid?: boolean | null
          last_verified_at?: string | null
          location?: string | null
          mode?: string | null
          posted_at?: string
          recruiter_avatar_url?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          report_count?: number
          responsibilities?: string[] | null
          skills?: string[] | null
          source_type?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          trust_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tags: {
        Row: {
          opportunity_id: string
          tag_name: string
        }
        Insert: {
          opportunity_id: string
          tag_name: string
        }
        Update: {
          opportunity_id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tags_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          degree: string | null
          deleted_at: string | null
          email: string
          graduation_year: number | null
          id: string
          interests: string[] | null
          name: string
          resume_url: string | null
          role: string
          skills: string[] | null
          suspended_at: string | null
          university: string | null
        }
        Insert: {
          created_at?: string
          degree?: string | null
          deleted_at?: string | null
          email: string
          graduation_year?: number | null
          id: string
          interests?: string[] | null
          name: string
          resume_url?: string | null
          role?: string
          skills?: string[] | null
          suspended_at?: string | null
          university?: string | null
        }
        Update: {
          created_at?: string
          degree?: string | null
          deleted_at?: string | null
          email?: string
          graduation_year?: number | null
          id?: string
          interests?: string[] | null
          name?: string
          resume_url?: string | null
          role?: string
          skills?: string[] | null
          suspended_at?: string | null
          university?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          reported_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          reported_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
