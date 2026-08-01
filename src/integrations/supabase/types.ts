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
  public: {
    Tables: {
      attendance_absences: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          reason: string | null
          session_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          reason?: string | null
          session_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          reason?: string | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_absences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          absent_count: number
          batch_id: string
          id: string
          institute_id: string
          marked_at: string
          marked_by: string | null
          session_date: string
          status: string
          total_students: number
          updated_at: string
        }
        Insert: {
          absent_count?: number
          batch_id: string
          id?: string
          institute_id: string
          marked_at?: string
          marked_by?: string | null
          session_date: string
          status?: string
          total_students?: number
          updated_at?: string
        }
        Update: {
          absent_count?: number
          batch_id?: string
          id?: string
          institute_id?: string
          marked_at?: string
          marked_by?: string | null
          session_date?: string
          status?: string
          total_students?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          at: string
          by_user: string | null
          entity: string
          entity_id: string
          id: string
          institute_id: string
          new_value: Json | null
          old_value: Json | null
          summary: string | null
        }
        Insert: {
          action: string
          at?: string
          by_user?: string | null
          entity: string
          entity_id: string
          id?: string
          institute_id: string
          new_value?: Json | null
          old_value?: Json | null
          summary?: string | null
        }
        Update: {
          action?: string
          at?: string
          by_user?: string | null
          entity?: string
          entity_id?: string
          id?: string
          institute_id?: string
          new_value?: Json | null
          old_value?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          active: boolean
          board: string | null
          capacity: number
          course: string | null
          created_at: string
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          end_date: string | null
          exam_category: string | null
          exam_year: number | null
          faculty: string | null
          id: string
          institute_id: string
          medium: string | null
          name: string
          standard: string | null
          start_date: string | null
          strength: number | null
          total_course_fee: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          board?: string | null
          capacity?: number
          course?: string | null
          created_at?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          exam_category?: string | null
          exam_year?: number | null
          faculty?: string | null
          id?: string
          institute_id: string
          medium?: string | null
          name: string
          standard?: string | null
          start_date?: string | null
          strength?: number | null
          total_course_fee?: number
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          board?: string | null
          capacity?: number
          course?: string | null
          created_at?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          exam_category?: string | null
          exam_year?: number | null
          faculty?: string | null
          id?: string
          institute_id?: string
          medium?: string | null
          name?: string
          standard?: string | null
          start_date?: string | null
          strength?: number | null
          total_course_fee?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          custom: boolean
          group_name: string
          id: string
          institute_id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom?: boolean
          group_name: string
          id?: string
          institute_id: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom?: boolean
          group_name?: string
          id?: string
          institute_id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_name: string | null
          category_id: string
          created_at: string
          created_by: string | null
          date: string
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          institute_id: string
          mode: string
          sub_category: string | null
          updated_at: string
          updated_by: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          attachment_name?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          date: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          institute_id: string
          mode?: string
          sub_category?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          attachment_name?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          institute_id?: string
          mode?: string
          sub_category?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_members: {
        Row: {
          access_enabled: boolean
          created_at: string
          display_name: string | null
          id: string
          institute_id: string
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: string
          user_id: string | null
        }
        Insert: {
          access_enabled?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          institute_id: string
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          user_id?: string | null
        }
        Update: {
          access_enabled?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          institute_id?: string
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institute_members_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      institutes: {
        Row: {
          address: string
          attendance_language: string
          attendance_lock_time: string | null
          created_at: string
          created_by: string
          email: string
          gst_number: string | null
          id: string
          logo_url: string | null
          master_boards: Json
          master_exam_categories: Json
          master_mediums: Json
          master_standards: Json
          name: string
          phone: string
          receipt_authorized_signatory: string
          receipt_email_override: string | null
          receipt_footer_text: string
          receipt_next_number: number
          receipt_phone_override: string | null
          receipt_prefix: string
          receipt_show_footer: boolean
          receipt_show_gst: boolean
          receipt_show_logo: boolean
          receipt_terms: string
          receipt_website_override: string | null
          subscription_status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string
          attendance_language?: string
          attendance_lock_time?: string | null
          created_at?: string
          created_by: string
          email?: string
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          master_boards?: Json
          master_exam_categories?: Json
          master_mediums?: Json
          master_standards?: Json
          name: string
          phone?: string
          receipt_authorized_signatory?: string
          receipt_email_override?: string | null
          receipt_footer_text?: string
          receipt_next_number?: number
          receipt_phone_override?: string | null
          receipt_prefix?: string
          receipt_show_footer?: boolean
          receipt_show_gst?: boolean
          receipt_show_logo?: boolean
          receipt_terms?: string
          receipt_website_override?: string | null
          subscription_status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string
          attendance_language?: string
          attendance_lock_time?: string | null
          created_at?: string
          created_by?: string
          email?: string
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          master_boards?: Json
          master_exam_categories?: Json
          master_mediums?: Json
          master_standards?: Json
          name?: string
          phone?: string
          receipt_authorized_signatory?: string
          receipt_email_override?: string | null
          receipt_footer_text?: string
          receipt_next_number?: number
          receipt_phone_override?: string | null
          receipt_prefix?: string
          receipt_show_footer?: boolean
          receipt_show_gst?: boolean
          receipt_show_logo?: boolean
          receipt_terms?: string
          receipt_website_override?: string | null
          subscription_status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          id: string
          institute_id: string
          mode: string
          note: string | null
          receipt_no: string
          student_id: string
          type: string
          updated_at: string
          voided: boolean
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          institute_id: string
          mode?: string
          note?: string | null
          receipt_no: string
          student_id: string
          type?: string
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          institute_id?: string
          mode?: string
          note?: string | null
          receipt_no?: string
          student_id?: string
          type?: string
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          balance: number
          created_at: string
          date: string
          id: string
          institute_id: string
          mode: string
          payment_id: string
          receipt_no: string
          student_id: string
        }
        Insert: {
          amount: number
          balance?: number
          created_at?: string
          date?: string
          id?: string
          institute_id: string
          mode?: string
          payment_id: string
          receipt_no: string
          student_id: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          date?: string
          id?: string
          institute_id?: string
          mode?: string
          payment_id?: string
          receipt_no?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string
          admission_fee: number
          batch_id: string | null
          board: string | null
          course: string | null
          course_fee: number
          created_at: string
          date_of_birth: string | null
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          discount: number
          email: string | null
          exam_category: string | null
          id: string
          installments: Json
          institute_id: string
          medium: string | null
          name: string
          paid_fee: number
          parent_name: string | null
          parent_phone: string | null
          phone: string
          photo: string | null
          roll_no: string
          standard: string | null
          status: string
          total_fee: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          admission_date?: string
          admission_fee?: number
          batch_id?: string | null
          board?: string | null
          course?: string | null
          course_fee?: number
          created_at?: string
          date_of_birth?: string | null
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number
          email?: string | null
          exam_category?: string | null
          id?: string
          installments?: Json
          institute_id: string
          medium?: string | null
          name: string
          paid_fee?: number
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string
          photo?: string | null
          roll_no?: string
          standard?: string | null
          status?: string
          total_fee?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          admission_date?: string
          admission_fee?: number
          batch_id?: string | null
          board?: string | null
          course?: string | null
          course_fee?: number
          created_at?: string
          date_of_birth?: string | null
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number
          email?: string | null
          exam_category?: string | null
          id?: string
          installments?: Json
          institute_id?: string
          medium?: string | null
          name?: string
          paid_fee?: number
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string
          photo?: string | null
          roll_no?: string
          standard?: string | null
          status?: string
          total_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_member_role: {
        Args: {
          _institute: string
          _member_id: string
          _role: Database["public"]["Enums"]["member_role"]
        }
        Returns: {
          access_enabled: boolean
          created_at: string
          display_name: string | null
          id: string
          institute_id: string
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "institute_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_institute_with_owner: {
        Args: {
          _address: string
          _email: string
          _name: string
          _phone: string
        }
        Returns: {
          address: string
          attendance_language: string
          attendance_lock_time: string | null
          created_at: string
          created_by: string
          email: string
          gst_number: string | null
          id: string
          logo_url: string | null
          master_boards: Json
          master_exam_categories: Json
          master_mediums: Json
          master_standards: Json
          name: string
          phone: string
          receipt_authorized_signatory: string
          receipt_email_override: string | null
          receipt_footer_text: string
          receipt_next_number: number
          receipt_phone_override: string | null
          receipt_prefix: string
          receipt_show_footer: boolean
          receipt_show_gst: boolean
          receipt_show_logo: boolean
          receipt_terms: string
          receipt_website_override: string | null
          subscription_status: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "institutes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_expense_breakdown_by_category: {
        Args: { _from: string; _institute: string; _to: string }
        Returns: {
          category_id: string
          category_name: string
          group_name: string
          total_amount: number
        }[]
      }
      get_profitability_summary: {
        Args: { _from: string; _institute: string; _to: string }
        Returns: {
          net_profit: number
          profit_margin_pct: number
          total_expenses: number
          total_revenue: number
        }[]
      }
      invite_member: {
        Args: {
          _email: string
          _institute: string
          _name: string
          _role: Database["public"]["Enums"]["member_role"]
        }
        Returns: {
          access_enabled: boolean
          created_at: string
          display_name: string | null
          id: string
          institute_id: string
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "institute_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_member: {
        Args: { _institute: string; _user: string }
        Returns: boolean
      }
      is_owner: {
        Args: { _institute: string; _user: string }
        Returns: boolean
      }
      is_owner_or_admin: {
        Args: { _institute: string; _user: string }
        Returns: boolean
      }
      mark_attendance_status: {
        Args: { _batch_id: string; _session_date: string; _status: string }
        Returns: string
      }
      next_receipt_number: { Args: { _institute: string }; Returns: string }
      remove_member: {
        Args: { _institute: string; _member_id: string }
        Returns: undefined
      }
      save_attendance: {
        Args: {
          _absent_student_ids: string[]
          _batch_id: string
          _session_date: string
        }
        Returns: string
      }
      sync_batch_course_fee: {
        Args: { _batch_id: string; _new_fee: number }
        Returns: undefined
      }
    }
    Enums: {
      member_role: "owner" | "staff" | "admin" | "teacher" | "accountant"
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
      member_role: ["owner", "staff", "admin", "teacher", "accountant"],
    },
  },
} as const
