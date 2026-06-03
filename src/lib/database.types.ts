export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activities: {
        Row: {
          athlete_id: string
          athlete_note: string | null
          avg_hr: number | null
          avg_pace: number | null
          avg_power: number | null
          created_at: string
          date: string
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          id: string
          intensity: number | null
          intervals_activity_id: string
          load: number | null
          max_hr: number | null
          name: string | null
          source: string
          sport: string | null
          start_time: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_note?: string | null
          avg_hr?: number | null
          avg_pace?: number | null
          avg_power?: number | null
          created_at?: string
          date: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          id?: string
          intensity?: number | null
          intervals_activity_id: string
          load?: number | null
          max_hr?: number | null
          name?: string | null
          source?: string
          sport?: string | null
          start_time?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_note?: string | null
          avg_hr?: number | null
          avg_pace?: number | null
          avg_power?: number | null
          created_at?: string
          date?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          id?: string
          intensity?: number | null
          intervals_activity_id?: string
          load?: number | null
          max_hr?: number | null
          name?: string | null
          source?: string
          sport?: string | null
          start_time?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string
          display_name: string
          email: string
          google_calendar_id: string | null
          google_drive_folder_id: string | null
          id: string
          intervals_athlete_id: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          google_calendar_id?: string | null
          google_drive_folder_id?: string | null
          id: string
          intervals_athlete_id?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          google_calendar_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          intervals_athlete_id?: string | null
          timezone?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          athlete_id: string
          atl: number | null
          body_weight: number | null
          calories: number | null
          carbs_g: number | null
          created_at: string
          ctl: number | null
          daily_load: number | null
          date: string
          fat_g: number | null
          hrv: number | null
          hydration_ml: number | null
          id: string
          notes: string | null
          protein_g: number | null
          readiness: number | null
          resting_hr: number | null
          sleep_hours: number | null
          sleep_score: number | null
          source: string
          tsb: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          atl?: number | null
          body_weight?: number | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          ctl?: number | null
          daily_load?: number | null
          date: string
          fat_g?: number | null
          hrv?: number | null
          hydration_ml?: number | null
          id?: string
          notes?: string | null
          protein_g?: number | null
          readiness?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          tsb?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          atl?: number | null
          body_weight?: number | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          ctl?: number | null
          daily_load?: number | null
          date?: string
          fat_g?: number | null
          hrv?: number | null
          hydration_ml?: number | null
          id?: string
          notes?: string | null
          protein_g?: number | null
          readiness?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          tsb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_manifests: {
        Row: {
          athlete_id: string
          change_reason: string | null
          created_at: string
          id: string
          notes: string | null
          race_date: string | null
          race_name: string | null
          race_type: string | null
          target_bike_time: string | null
          target_overall_time: string | null
          target_run_time: string | null
          target_swim_time: string | null
          target_t1_time: string | null
          target_t2_time: string | null
          valid_from: string
          version: number
        }
        Insert: {
          athlete_id: string
          change_reason?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          race_date?: string | null
          race_name?: string | null
          race_type?: string | null
          target_bike_time?: string | null
          target_overall_time?: string | null
          target_run_time?: string | null
          target_swim_time?: string | null
          target_t1_time?: string | null
          target_t2_time?: string | null
          valid_from?: string
          version: number
        }
        Update: {
          athlete_id?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          race_date?: string | null
          race_name?: string | null
          race_type?: string | null
          target_bike_time?: string | null
          target_overall_time?: string | null
          target_run_time?: string | null
          target_swim_time?: string | null
          target_t1_time?: string | null
          target_t2_time?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_manifests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sessions: {
        Row: {
          athlete_id: string
          created_at: string
          day_of_week: number | null
          duration_min: number | null
          google_event_id: string | null
          id: string
          plan_id: string
          rationale: string | null
          session_type: string | null
          sort_order: number | null
          sport: string | null
          target_metrics: Json | null
          target_zone: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          day_of_week?: number | null
          duration_min?: number | null
          google_event_id?: string | null
          id?: string
          plan_id: string
          rationale?: string | null
          session_type?: string | null
          sort_order?: number | null
          sport?: string | null
          target_metrics?: Json | null
          target_zone?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          day_of_week?: number | null
          duration_min?: number | null
          google_event_id?: string | null
          id?: string
          plan_id?: string
          rationale?: string | null
          session_type?: string | null
          sort_order?: number | null
          sport?: string | null
          target_metrics?: Json | null
          target_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          approved_at: string | null
          athlete_id: string
          created_at: string
          id: string
          raw_json: Json | null
          source: string
          status: string
          synced_at: string | null
          version: number
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          athlete_id: string
          created_at?: string
          id?: string
          raw_json?: Json | null
          source?: string
          status?: string
          synced_at?: string | null
          version?: number
          week_start: string
        }
        Update: {
          approved_at?: string | null
          athlete_id?: string
          created_at?: string
          id?: string
          raw_json?: Json | null
          source?: string
          status?: string
          synced_at?: string | null
          version?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_profiles: {
        Row: {
          athlete_id: string
          available_days: Json | null
          change_reason: string | null
          constraints_notes: string | null
          created_at: string
          id: string
          max_hours_per_week: number | null
          preferred_long_ride_day: string | null
          preferred_long_run_day: string | null
          rest_day: string | null
          valid_from: string
          version: number
        }
        Insert: {
          athlete_id: string
          available_days?: Json | null
          change_reason?: string | null
          constraints_notes?: string | null
          created_at?: string
          id?: string
          max_hours_per_week?: number | null
          preferred_long_ride_day?: string | null
          preferred_long_run_day?: string | null
          rest_day?: string | null
          valid_from?: string
          version: number
        }
        Update: {
          athlete_id?: string
          available_days?: Json | null
          change_reason?: string | null
          constraints_notes?: string | null
          created_at?: string
          id?: string
          max_hours_per_week?: number | null
          preferred_long_ride_day?: string | null
          preferred_long_run_day?: string | null
          rest_day?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "preference_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          athlete_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          template: string
          version: number
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          template: string
          version?: number
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_feedback: {
        Row: {
          athlete_id: string
          created_at: string
          feedback_text: string
          id: string
          source_plan_id: string | null
          week_start: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          feedback_text: string
          id?: string
          source_plan_id?: string | null
          week_start: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          feedback_text?: string
          id?: string
          source_plan_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_feedback_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_feedback_source_plan_id_fkey"
            columns: ["source_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          locked_at: string | null
          rendered_prompt: string | null
          status: string
          week_start: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          locked_at?: string | null
          rendered_prompt?: string | null
          status?: string
          week_start: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          locked_at?: string | null
          rendered_prompt?: string | null
          status?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reviews_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_goal_manifest: {
        Row: {
          athlete_id: string | null
          change_reason: string | null
          created_at: string | null
          id: string | null
          notes: string | null
          race_date: string | null
          race_name: string | null
          race_type: string | null
          target_bike_time: string | null
          target_overall_time: string | null
          target_run_time: string | null
          target_swim_time: string | null
          target_t1_time: string | null
          target_t2_time: string | null
          valid_from: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_manifests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      current_preference_profile: {
        Row: {
          athlete_id: string | null
          available_days: Json | null
          change_reason: string | null
          constraints_notes: string | null
          created_at: string | null
          id: string | null
          max_hours_per_week: number | null
          preferred_long_ride_day: string | null
          preferred_long_run_day: string | null
          rest_day: string | null
          valid_from: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "preference_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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

