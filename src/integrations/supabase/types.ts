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
      assessments: {
        Row: {
          ca1: number | null
          ca2: number | null
          class_id: string | null
          created_at: string
          exam: number | null
          grade: string | null
          id: string
          remark: string | null
          school_id: string
          session: string
          status: Database["public"]["Enums"]["assessment_status"]
          student_id: string
          subject_id: string
          teacher_id: string | null
          term: Database["public"]["Enums"]["term_name"]
          total: number | null
          updated_at: string
        }
        Insert: {
          ca1?: number | null
          ca2?: number | null
          class_id?: string | null
          created_at?: string
          exam?: number | null
          grade?: string | null
          id?: string
          remark?: string | null
          school_id: string
          session: string
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id: string
          subject_id: string
          teacher_id?: string | null
          term: Database["public"]["Enums"]["term_name"]
          total?: number | null
          updated_at?: string
        }
        Update: {
          ca1?: number | null
          ca2?: number | null
          class_id?: string | null
          created_at?: string
          exam?: number | null
          grade?: string | null
          id?: string
          remark?: string | null
          school_id?: string
          session?: string
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id?: string
          subject_id?: string
          teacher_id?: string | null
          term?: Database["public"]["Enums"]["term_name"]
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          arm: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          school_id: string
          section: Database["public"]["Enums"]["class_section"] | null
          teacher_id: string | null
        }
        Insert: {
          arm?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          school_id: string
          section?: Database["public"]["Enums"]["class_section"] | null
          teacher_id?: string | null
        }
        Update: {
          arm?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          school_id?: string
          section?: Database["public"]["Enums"]["class_section"] | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string | null
          fee_item_id: string | null
          id: string
          school_id: string
          session: string
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term: Database["public"]["Enums"]["term_name"]
          title: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          fee_item_id?: string | null
          id?: string
          school_id: string
          session: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term: Database["public"]["Enums"]["term_name"]
          title: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          fee_item_id?: string | null
          id?: string
          school_id?: string
          session?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          term?: Database["public"]["Enums"]["term_name"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoices_fee_item_id_fkey"
            columns: ["fee_item_id"]
            isOneToOne: false
            referencedRelation: "fee_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_items: {
        Row: {
          active: boolean
          amount: number
          class_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          session: string
          term: Database["public"]["Enums"]["term_name"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          class_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          session: string
          term: Database["public"]["Enums"]["term_name"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          session?: string
          term?: Database["public"]["Enums"]["term_name"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          receipt_no: string
          recorded_by: string | null
          reference: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          delivered: boolean | null
          error: string | null
          id: string
          meta: Json | null
          read_at: string | null
          school_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered?: boolean | null
          error?: string | null
          id?: string
          meta?: Json | null
          read_at?: string | null
          school_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered?: boolean | null
          error?: string | null
          id?: string
          meta?: Json | null
          read_at?: string | null
          school_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      parent_notifications: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          meta: Json
          parent_id: string | null
          read_at: string | null
          school_id: string
          student_id: string | null
          title: string
          type: Database["public"]["Enums"]["parent_notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          parent_id?: string | null
          read_at?: string | null
          school_id: string
          student_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["parent_notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          parent_id?: string | null
          read_at?: string | null
          school_id?: string
          student_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["parent_notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          occupation: string | null
          phone: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          occupation?: string | null
          phone?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          occupation?: string | null
          phone?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          affective: Json | null
          average: number | null
          class_id: string | null
          class_size: number | null
          created_at: string
          days_absent: number | null
          days_present: number | null
          days_total: number | null
          gpa: number | null
          id: string
          next_resumption_date: string | null
          pdf_url: string | null
          position: number | null
          principal_remark: string | null
          psychomotor: Json | null
          published: boolean | null
          school_id: string
          session: string
          student_id: string
          subjects_count: number | null
          teacher_remark: string | null
          term: Database["public"]["Enums"]["term_name"]
          total_score: number | null
          verification_code: string | null
        }
        Insert: {
          affective?: Json | null
          average?: number | null
          class_id?: string | null
          class_size?: number | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          days_total?: number | null
          gpa?: number | null
          id?: string
          next_resumption_date?: string | null
          pdf_url?: string | null
          position?: number | null
          principal_remark?: string | null
          psychomotor?: Json | null
          published?: boolean | null
          school_id: string
          session: string
          student_id: string
          subjects_count?: number | null
          teacher_remark?: string | null
          term: Database["public"]["Enums"]["term_name"]
          total_score?: number | null
          verification_code?: string | null
        }
        Update: {
          affective?: Json | null
          average?: number | null
          class_id?: string | null
          class_size?: number | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          days_total?: number | null
          gpa?: number | null
          id?: string
          next_resumption_date?: string | null
          pdf_url?: string | null
          position?: number | null
          principal_remark?: string | null
          psychomotor?: Json | null
          published?: boolean | null
          school_id?: string
          session?: string
          student_id?: string
          subjects_count?: number | null
          teacher_remark?: string | null
          term?: Database["public"]["Enums"]["term_name"]
          total_score?: number | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          branch_name: string | null
          code: string
          created_at: string
          current_session: string | null
          current_term: Database["public"]["Enums"]["term_name"] | null
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          motto: string | null
          name: string
          phone: string | null
          principal_name: string | null
          principal_signature_url: string | null
          stamp_url: string | null
          theme_color: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_name?: string | null
          code: string
          created_at?: string
          current_session?: string | null
          current_term?: Database["public"]["Enums"]["term_name"] | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          motto?: string | null
          name: string
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          stamp_url?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_name?: string | null
          code?: string
          created_at?: string
          current_session?: string | null
          current_term?: Database["public"]["Enums"]["term_name"] | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          motto?: string | null
          name?: string
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          stamp_url?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      student_parents: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
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
          admission_date: string | null
          admission_no: string
          blood_group: string | null
          class_id: string | null
          created_at: string
          dob: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          genotype: string | null
          house: string | null
          id: string
          last_name: string
          medical_notes: string | null
          middle_name: string | null
          next_resumption_date: string | null
          photo_url: string | null
          previous_school: string | null
          religion: string | null
          school_id: string
          state_of_origin: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          admission_no: string
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          genotype?: string | null
          house?: string | null
          id?: string
          last_name: string
          medical_notes?: string | null
          middle_name?: string | null
          next_resumption_date?: string | null
          photo_url?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id: string
          state_of_origin?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          admission_no?: string
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          genotype?: string | null
          house?: string | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          middle_name?: string | null
          next_resumption_date?: string | null
          photo_url?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id?: string
          state_of_origin?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_parent_by_phone: {
        Args: { _phone: string }
        Returns: {
          full_name: string
          parent_id: string
          school_id: string
        }[]
      }
      get_user_school: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      in_same_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_link_owner: {
        Args: { _parent_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_staff: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      notify_fee_defaulters: {
        Args: { _created_by: string; _school_id: string }
        Returns: number
      }
      student_school_id: { Args: { _student_id: string }; Returns: string }
      verify_report_card: {
        Args: { _code: string }
        Returns: {
          admission_no: string
          average: number
          class_name: string
          position: number
          published: boolean
          school_name: string
          session: string
          student_name: string
          term: Database["public"]["Enums"]["term_name"]
          total_score: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "teacher"
        | "student"
        | "parent"
        | "accountant"
      assessment_status: "draft" | "submitted" | "approved"
      attendance_status: "present" | "absent" | "late" | "excused"
      class_section: "nursery" | "primary" | "secondary"
      gender_type: "male" | "female"
      invoice_status: "unpaid" | "partial" | "paid" | "overdue"
      parent_notification_type:
        | "news"
        | "fee_reminder"
        | "defaulter"
        | "message"
        | "general"
      term_name: "first" | "second" | "third"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "school_admin",
        "teacher",
        "student",
        "parent",
        "accountant",
      ],
      assessment_status: ["draft", "submitted", "approved"],
      attendance_status: ["present", "absent", "late", "excused"],
      class_section: ["nursery", "primary", "secondary"],
      gender_type: ["male", "female"],
      invoice_status: ["unpaid", "partial", "paid", "overdue"],
      parent_notification_type: [
        "news",
        "fee_reminder",
        "defaulter",
        "message",
        "general",
      ],
      term_name: ["first", "second", "third"],
    },
  },
} as const
