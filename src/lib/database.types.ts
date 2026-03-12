// Auto-generated Database types for Supabase type safety.
// Re-run `npx supabase gen types typescript` after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      hospitals: {
        Row: {
          id: string
          name: string
          city: string
          country: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          city?: string
          country?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string
          country?: string
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'doctor' | 'admin' | 'patient'
          hospital_id: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'doctor' | 'admin' | 'patient'
          hospital_id?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'doctor' | 'admin' | 'patient'
          hospital_id?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients_data: {
        Row: {
          id: string
          user_id: string
          medical_history: Json
          contact_info: Json
          date_of_birth: string | null
          dni: string | null
          insurance_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          medical_history?: Json
          contact_info?: Json
          date_of_birth?: string | null
          dni?: string | null
          insurance_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          medical_history?: Json
          contact_info?: Json
          date_of_birth?: string | null
          dni?: string | null
          insurance_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      doctors_data: {
        Row: {
          id: string
          user_id: string
          specialty: string
          available_slots: Json
          room_number: string | null
          cmp_license: string | null
          max_daily_patients: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          specialty: string
          available_slots?: Json
          room_number?: string | null
          cmp_license?: string | null
          max_daily_patients?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          specialty?: string
          available_slots?: Json
          room_number?: string | null
          cmp_license?: string | null
          max_daily_patients?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments_pool: {
        Row: {
          id: string
          patient_id: string
          requested_specialty: string
          urgency_level: number
          symptoms: string | null
          status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
          walk_in: boolean
          inserted_by_admin: string | null
          preferred_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          requested_specialty: string
          urgency_level: number
          symptoms?: string | null
          status?: 'pending' | 'scheduled' | 'completed' | 'cancelled'
          walk_in?: boolean
          inserted_by_admin?: string | null
          preferred_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          requested_specialty?: string
          urgency_level?: number
          symptoms?: string | null
          status?: 'pending' | 'scheduled' | 'completed' | 'cancelled'
          walk_in?: boolean
          inserted_by_admin?: string | null
          preferred_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_pool_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      optimizer_runs: {
        Row: {
          id: string
          triggered_by: string
          run_at: string
          parameters: Json
          status: 'running' | 'completed' | 'failed'
          result_summary: Json | null
          error_message: string | null
          duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          triggered_by: string
          run_at?: string
          parameters?: Json
          status?: 'running' | 'completed' | 'failed'
          result_summary?: Json | null
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          triggered_by?: string
          run_at?: string
          parameters?: Json
          status?: 'running' | 'completed' | 'failed'
          result_summary?: Json | null
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimizer_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      schedules: {
        Row: {
          id: string
          appointment_id: string
          doctor_id: string
          scheduled_datetime: string
          room: string | null
          optimizer_run_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          doctor_id: string
          scheduled_datetime: string
          room?: string | null
          optimizer_run_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          doctor_id?: string
          scheduled_datetime?: string
          room?: string | null
          optimizer_run_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      admin_pending_appointments: {
        Row: {
          id: string
          urgency_level: number
          requested_specialty: string
          symptoms: string | null
          walk_in: boolean
          created_at: string
          status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
          patient_name: string
          patient_email: string
        }
        Relationships: []
      }
      doctor_schedule_view: {
        Row: {
          schedule_id: string
          scheduled_datetime: string
          room: string | null
          completed_at: string | null
          urgency_level: number
          symptoms: string | null
          requested_specialty: string
          patient_name: string
          doctor_id: string
          appointment_id: string
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      user_role: 'doctor' | 'admin' | 'patient'
      appointment_status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
      optimizer_run_status: 'running' | 'completed' | 'failed'
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never
