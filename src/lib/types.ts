// ============================================================
// TypeScript types matching the Supabase schema
// ============================================================

export type UserRole = 'doctor' | 'admin' | 'patient'
export type AppointmentStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled'
export type OptimizerRunStatus = 'running' | 'completed' | 'failed'

export interface Hospital {
  id: string
  name: string
  city: string
  country: string
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  hospital_id: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface MedicalHistory {
  blood_type?: string
  allergies?: string[]
  chronic_conditions?: string[]
  medications?: string[]
  past_surgeries?: string[]
}

export interface ContactInfo {
  phone?: string
  address?: string
  emergency_contact?: {
    name: string
    phone: string
    relationship: string
  }
}

export interface PatientData {
  id: string
  user_id: string
  medical_history: MedicalHistory
  contact_info: ContactInfo
  date_of_birth: string | null
  dni: string | null
  insurance_code: string | null
  created_at: string
  updated_at: string
}

export interface AvailableSlot {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
}

export interface DoctorData {
  id: string
  user_id: string
  specialty: string
  available_slots: AvailableSlot[]
  room_number: string | null
  cmp_license: string | null
  max_daily_patients: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AppointmentPool {
  id: string
  patient_id: string
  requested_specialty: string
  urgency_level: number   // 1–10
  symptoms: string | null
  status: AppointmentStatus
  walk_in: boolean
  inserted_by_admin: string | null
  preferred_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OptimizerParameters {
  lambda1: number
  lambda2: number
  num_reads: number
  num_sweeps: number
  beta_range?: [number, number]
}

export interface OptimizerResultSummary {
  assigned: number
  unassigned: number
  energy: number
  duration_ms: number
}

export interface OptimizerRun {
  id: string
  triggered_by: string
  run_at: string
  parameters: OptimizerParameters
  status: OptimizerRunStatus
  result_summary: OptimizerResultSummary | null
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

export interface Schedule {
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

// ============================================================
// View types (denormalized for UI)
// ============================================================

export interface AdminPendingAppointment {
  id: string
  urgency_level: number
  requested_specialty: string
  symptoms: string | null
  walk_in: boolean
  created_at: string
  status: AppointmentStatus
  patient_name: string
  patient_email: string
}

export interface DoctorScheduleEntry {
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

// ============================================================
// API types for the Python optimizer microservice
// ============================================================

export interface OptimizerPatientInput {
  id: string
  urgency: number
  specialty: string
}

export interface OptimizerDoctorInput {
  id: string
  specialty: string
  available_slots: AvailableSlot[]
  max_daily_patients: number
  room_number: string | null
}

export interface OptimizerRequest {
  patients: OptimizerPatientInput[]
  doctors: OptimizerDoctorInput[]
  parameters: OptimizerParameters
  optimizer_run_id: string
}

export interface OptimizerAssignment {
  patient_id: string
  doctor_id: string
  time_slot: string  // ISO datetime string
  room: string | null
}

export interface OptimizerResponse {
  assignments: OptimizerAssignment[]
  summary: OptimizerResultSummary
}
