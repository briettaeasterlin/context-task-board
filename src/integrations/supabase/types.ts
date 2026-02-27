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
          name: string
          scope_notes: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["task_area"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          scope_notes?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: Database["public"]["Enums"]["task_area"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          scope_notes?: string | null
          summary?: string | null
          updated_at?: string
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
          milestone_id: string | null
          notes: string | null
          project: string | null
          project_id: string | null
          sort_order: number | null
          source: string | null
          status: Database["public"]["Enums"]["task_status"]
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
          milestone_id?: string | null
          notes?: string | null
          project?: string | null
          project_id?: string | null
          sort_order?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
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
          milestone_id?: string | null
          notes?: string | null
          project?: string | null
          project_id?: string | null
          sort_order?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
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
          updated_at?: string
          user_id?: string
          workday_end?: string
          workday_start?: string
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
      task_area: "Client" | "Business" | "Home" | "Family" | "Personal"
      task_status: "Backlog" | "Next" | "Waiting" | "Done"
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
      task_area: ["Client", "Business", "Home", "Family", "Personal"],
      task_status: ["Backlog", "Next", "Waiting", "Done"],
      update_source: ["chatgpt", "meeting", "email", "call", "doc"],
    },
  },
} as const
