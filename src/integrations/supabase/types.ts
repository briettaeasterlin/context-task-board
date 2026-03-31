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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          allowed_ips: string[] | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          label: string
          last_used_at: string | null
          permissions: string[]
          user_id: string
        }
        Insert: {
          allowed_ips?: string[] | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          label?: string
          last_used_at?: string | null
          permissions?: string[]
          user_id: string
        }
        Update: {
          allowed_ips?: string[] | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          label?: string
          last_used_at?: string | null
          permissions?: string[]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          proposed_change_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          proposed_change_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          proposed_change_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_proposed_change_id_fkey"
            columns: ["proposed_change_id"]
            isOneToOne: false
            referencedRelation: "proposed_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events_cache: {
        Row: {
          end_time: string
          id: string
          is_all_day: boolean
          location: string | null
          start_time: string
          synced_at: string
          title: string
          user_id: string
        }
        Insert: {
          end_time: string
          id: string
          is_all_day?: boolean
          location?: string | null
          start_time: string
          synced_at?: string
          title: string
          user_id: string
        }
        Update: {
          end_time?: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          start_time?: string
          synced_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      clarify_questions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          project_id: string
          question: string
          reason: string | null
          status: Database["public"]["Enums"]["clarify_status"]
          suggested_options: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          project_id: string
          question: string
          reason?: string | null
          status?: Database["public"]["Enums"]["clarify_status"]
          suggested_options?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          project_id?: string
          question?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["clarify_status"]
          suggested_options?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarify_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_completions: {
        Row: {
          completed_date: string
          created_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_date?: string
          created_at?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habit_intentions"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_intentions: {
        Row: {
          active: boolean
          cadence: Database["public"]["Enums"]["habit_cadence"]
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["habit_cadence"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["habit_cadence"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          completion_rule: Database["public"]["Enums"]["completion_rule"]
          created_at: string
          description: string | null
          id: string
          is_complete: boolean
          name: string
          order_index: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_rule?: Database["public"]["Enums"]["completion_rule"]
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          name: string
          order_index?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_rule?: Database["public"]["Enums"]["completion_rule"]
          created_at?: string
          description?: string | null
          id?: string
          is_complete?: boolean
          name?: string
          order_index?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_actions: {
        Row: {
          action_type: string
          confidence: string | null
          created_at: string | null
          detail: Json | null
          id: string
          operation_log_id: string
          target_id: string | null
          target_title: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          action_type: string
          confidence?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: string
          operation_log_id: string
          target_id?: string | null
          target_title?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          action_type?: string
          confidence?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: string
          operation_log_id?: string
          target_id?: string | null
          target_title?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_actions_operation_log_id_fkey"
            columns: ["operation_log_id"]
            isOneToOne: false
            referencedRelation: "operation_log"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_log: {
        Row: {
          created_at: string | null
          id: string
          operation_id: string
          payload: Json
          payload_hash: string | null
          processed_at: string | null
          result: Json | null
          schema_version: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          operation_id: string
          payload: Json
          payload_hash?: string | null
          processed_at?: string | null
          result?: Json | null
          schema_version?: string | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          operation_id?: string
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          result?: Json | null
          schema_version?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      planned_task_blocks: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number
          id: string
          locked: boolean
          notes: string | null
          source: string
          start_time: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes?: number
          id?: string
          locked?: boolean
          notes?: string | null
          source?: string
          start_time: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          locked?: boolean
          notes?: string | null
          source?: string
          start_time?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_task_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area: Database["public"]["Enums"]["task_area"]
          created_at: string
          deleted_at: string | null
          id: string
          line_color: string | null
          name: string
          scope_notes: string | null
          strategic_phase: Database["public"]["Enums"]["strategic_phase"] | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["task_area"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          line_color?: string | null
          name: string
          scope_notes?: string | null
          strategic_phase?:
            | Database["public"]["Enums"]["strategic_phase"]
            | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: Database["public"]["Enums"]["task_area"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          line_color?: string | null
          name?: string
          scope_notes?: string | null
          strategic_phase?:
            | Database["public"]["Enums"]["strategic_phase"]
            | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposed_changes: {
        Row: {
          change_type: string
          confidence: string | null
          created_at: string
          id: string
          proposed_fields: Json | null
          reasoning: string | null
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["proposed_change_status"]
          summary: string
          target_project_id: string | null
          target_task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          change_type: string
          confidence?: string | null
          created_at?: string
          id?: string
          proposed_fields?: Json | null
          reasoning?: string | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["proposed_change_status"]
          summary: string
          target_project_id?: string | null
          target_task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          change_type?: string
          confidence?: string | null
          created_at?: string
          id?: string
          proposed_fields?: Json | null
          reasoning?: string | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["proposed_change_status"]
          summary?: string
          target_project_id?: string | null
          target_task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_changes_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "source_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_changes_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_changes_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          api_key_id: string
          id: string
          requested_at: string | null
        }
        Insert: {
          api_key_id: string
          id?: string
          requested_at?: string | null
        }
        Update: {
          api_key_id?: string
          id?: string
          requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      source_events: {
        Row: {
          created_at: string
          id: string
          raw_content: string
          received_at: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_content: string
          received_at?: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_content?: string
          received_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          area: Database["public"]["Enums"]["task_area"]
          blocked_by: string | null
          context: string | null
          context_tag: string | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          impact_score: number | null
          link: string | null
          milestone_id: string | null
          notes: string | null
          planned_date: string | null
          project: string | null
          project_id: string | null
          sort_order: number | null
          source: string | null
          status: Database["public"]["Enums"]["task_status"]
          strategic_phase: Database["public"]["Enums"]["strategic_phase"] | null
          tags: string[] | null
          target_window: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["task_area"]
          blocked_by?: string | null
          context?: string | null
          context_tag?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          impact_score?: number | null
          link?: string | null
          milestone_id?: string | null
          notes?: string | null
          planned_date?: string | null
          project?: string | null
          project_id?: string | null
          sort_order?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          strategic_phase?:
            | Database["public"]["Enums"]["strategic_phase"]
            | null
          tags?: string[] | null
          target_window?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: Database["public"]["Enums"]["task_area"]
          blocked_by?: string | null
          context?: string | null
          context_tag?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          impact_score?: number | null
          link?: string | null
          milestone_id?: string | null
          notes?: string | null
          planned_date?: string | null
          project?: string | null
          project_id?: string | null
          sort_order?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          strategic_phase?:
            | Database["public"]["Enums"]["strategic_phase"]
            | null
          tags?: string[] | null
          target_window?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      updates: {
        Row: {
          content: string
          created_at: string
          extracted_summary: string | null
          extracted_tasks: Json | null
          id: string
          project_id: string | null
          source: Database["public"]["Enums"]["update_source"] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          extracted_summary?: string | null
          extracted_tasks?: Json | null
          id?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["update_source"] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          extracted_summary?: string | null
          extracted_tasks?: Json | null
          id?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["update_source"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_planner_settings: {
        Row: {
          created_at: string
          gcal_access_token: string | null
          gcal_connected: boolean
          gcal_refresh_token: string | null
          gcal_timezone: string | null
          gcal_token_expires_at: string | null
          max_next_tasks: number
          overlay_ics_token: string | null
          overlay_ics_token_expires_at: string | null
          updated_at: string
          user_id: string
          workday_end: string
          workday_start: string
        }
        Insert: {
          created_at?: string
          gcal_access_token?: string | null
          gcal_connected?: boolean
          gcal_refresh_token?: string | null
          gcal_timezone?: string | null
          gcal_token_expires_at?: string | null
          max_next_tasks?: number
          overlay_ics_token?: string | null
          overlay_ics_token_expires_at?: string | null
          updated_at?: string
          user_id: string
          workday_end?: string
          workday_start?: string
        }
        Update: {
          created_at?: string
          gcal_access_token?: string | null
          gcal_connected?: boolean
          gcal_refresh_token?: string | null
          gcal_timezone?: string | null
          gcal_token_expires_at?: string | null
          max_next_tasks?: number
          overlay_ics_token?: string | null
          overlay_ics_token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          workday_end?: string
          workday_start?: string
        }
        Relationships: []
      }
      user_rate_limit_log: {
        Row: {
          function_name: string
          id: string
          requested_at: string
          user_id: string
        }
        Insert: {
          function_name: string
          id?: string
          requested_at?: string
          user_id: string
        }
        Update: {
          function_name?: string
          id?: string
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      clarify_status: "open" | "answered" | "dismissed"
      completion_rule: "manual" | "tasks_based"
      habit_cadence: "Daily" | "Weekly" | "Often" | "Seasonal"
      proposed_change_status: "pending" | "applied" | "rejected"
      strategic_phase:
        | "scoping"
        | "active_engagement"
        | "closed_followup"
        | "internal_ops"
      task_area: "Client" | "Business" | "Home" | "Family" | "Personal"
      task_status:
        | "Today"
        | "Backlog"
        | "Next"
        | "Waiting"
        | "Closing"
        | "Done"
        | "Someday"
      update_source: "chatgpt" | "meeting" | "email" | "call" | "doc"
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
      clarify_status: ["open", "answered", "dismissed"],
      completion_rule: ["manual", "tasks_based"],
      habit_cadence: ["Daily", "Weekly", "Often", "Seasonal"],
      proposed_change_status: ["pending", "applied", "rejected"],
      strategic_phase: [
        "scoping",
        "active_engagement",
        "closed_followup",
        "internal_ops",
      ],
      task_area: ["Client", "Business", "Home", "Family", "Personal"],
      task_status: [
        "Today",
        "Backlog",
        "Next",
        "Waiting",
        "Closing",
        "Done",
        "Someday",
      ],
      update_source: ["chatgpt", "meeting", "email", "call", "doc"],
    },
  },
} as const
