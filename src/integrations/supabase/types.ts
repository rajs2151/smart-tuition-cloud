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
      audit_logs: {
        Row: {
          action: string
          at: string
          by_user: string | null
          entity: string
          entity_id: string
          id: string
          institute_id: string
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
          monthly_fee: number
          name: string
          standard: string | null
          start_date: string | null
          strength: number | null
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
          monthly_fee?: number
          name: string
          standard?: string | null
          start_date?: string | null
          strength?: number | null
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
          monthly_fee?: number
          name?: string
          standard?: string | null
          start_date?: string | null
          strength?: number | null
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
      institute_members: {
        Row: {
          created_at: string
          id: string
          institute_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institute_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institute_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
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
          receipt_footer_text: string
          receipt_next_number: number
          receipt_prefix: string
          receipt_show_footer: boolean
          receipt_show_gst: boolean
          receipt_show_logo: boolean
          receipt_terms: string
          subscription_status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string
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
          receipt_footer_text?: string
          receipt_next_number?: number
          receipt_prefix?: string
          receipt_show_footer?: boolean
          receipt_show_gst?: boolean
          receipt_show_logo?: boolean
          receipt_terms?: string
          subscription_status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string
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
          receipt_footer_text?: string
          receipt_next_number?: number
          receipt_prefix?: string
          receipt_show_footer?: boolean
          receipt_show_gst?: boolean
          receipt_show_logo?: boolean
          receipt_terms?: string
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
      is_member: {
        Args: { _institute: string; _user: string }
        Returns: boolean
      }
      is_owner: {
        Args: { _institute: string; _user: string }
        Returns: boolean
      }
      next_receipt_number: { Args: { _institute: string }; Returns: string }
    }
    Enums: {
      member_role: "owner" | "staff"
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
      member_role: ["owner", "staff"],
    },
  },
} as const
