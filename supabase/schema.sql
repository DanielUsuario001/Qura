-- ============================================================
-- QUANTUM HEALTH SCHEDULER — Supabase Schema
-- Scalable design supporting multi-hospital, RLS, and QUBO
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search on specialties

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('doctor', 'admin', 'patient');
CREATE TYPE appointment_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');
CREATE TYPE optimizer_run_status AS ENUM ('running', 'completed', 'failed');

-- ============================================================
-- TABLE: hospitals (multi-tenant ready)
-- ============================================================
CREATE TABLE hospitals (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  city       TEXT NOT NULL DEFAULT 'Lima',
  country    TEXT NOT NULL DEFAULT 'PE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default hospital
INSERT INTO hospitals (name, city) VALUES ('Hospital Nacional Base', 'Lima');

-- ============================================================
-- TABLE: users (extends auth.users via trigger)
-- ============================================================
CREATE TABLE users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  full_name    TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'patient',
  hospital_id  UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  avatar_url   TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for role-based filtering
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_hospital ON users(hospital_id);

-- ============================================================
-- TABLE: patients_data
-- ============================================================
CREATE TABLE patients_data (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- Structured JSONB with lifestyle and hereditary_diseases sections
  medical_history JSONB NOT NULL DEFAULT '{
    "blood_type": null,
    "allergies": [],
    "chronic_conditions": [],
    "current_medications": [],
    "previous_surgeries": [],
    "lifestyle": {
      "smoking": false,
      "alcohol": "none",
      "physical_activity": "sedentary",
      "diet": null
    },
    "hereditary_diseases": {
      "diabetes": false,
      "hypertension": false,
      "cancer": false,
      "heart_disease": false,
      "notes": null
    }
  }'::jsonb,
  contact_info    JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"emergency_contact": {...}, "address": "..."}
  phone           TEXT,         -- teléfono dedicado (más rápido que JSONB)
  date_of_birth   DATE,
  dni             TEXT UNIQUE,  -- Peruvian national ID
  insurance_code  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_user ON patients_data(user_id);

-- ============================================================
-- TABLE: doctors_data
-- ============================================================
CREATE TABLE doctors_data (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty           TEXT NOT NULL,
  -- available_slots: array of weekly slot objects
  -- [{"day": "monday", "start_time": "08:00", "end_time": "12:00"}, ...]
  available_slots     JSONB NOT NULL DEFAULT '[]',
  room_number         TEXT,
  cmp_license         TEXT UNIQUE, -- Colegio Médico del Perú license
  dni                 TEXT UNIQUE, -- DNI del médico
  phone               TEXT,
  max_daily_patients  INT NOT NULL DEFAULT 12,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_user ON doctors_data(user_id);
CREATE INDEX idx_doctors_specialty ON doctors_data(specialty);
-- Trigram index for fuzzy specialty search
CREATE INDEX idx_doctors_specialty_trgm ON doctors_data USING GIN (specialty gin_trgm_ops);

-- ============================================================
-- TABLE: appointments_pool
-- The queue that feeds the QUBO optimizer
-- ============================================================
-- Referral source: direct web request vs. official GP interconsulta (MINSA/EsSalud model)
-- Maps to R_i in the QUBO model: 'direct'→1.0, 'doctor_referred'→10.0
CREATE TYPE referral_source_type AS ENUM ('direct', 'doctor_referred');

CREATE TABLE appointments_pool (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_specialty TEXT NOT NULL,
  urgency_level       INT NOT NULL CHECK (urgency_level BETWEEN 1 AND 10),
  symptoms            TEXT,
  status              appointment_status NOT NULL DEFAULT 'pending',
  walk_in             BOOLEAN NOT NULL DEFAULT FALSE,
  inserted_by_admin   UUID REFERENCES users(id) ON DELETE SET NULL,
  preferred_date      DATE,
  notes               TEXT,
  -- R_i parameter: 'direct' = patient self-scheduled (R=1), 'doctor_referred' = GP interconsulta (R=10)
  referral_source     referral_source_type NOT NULL DEFAULT 'direct',
  -- Doctor who issued the referral (only populated when referral_source = 'doctor_referred')
  referred_by_doctor  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: optimizer queries pending appointments ordered by urgency
CREATE INDEX idx_pool_status_urgency ON appointments_pool(status, urgency_level DESC);
CREATE INDEX idx_pool_patient ON appointments_pool(patient_id);
CREATE INDEX idx_pool_created ON appointments_pool(created_at DESC);

-- ============================================================
-- TABLE: optimizer_runs
-- Audit log of every QUBO optimization execution
-- ============================================================
CREATE TABLE optimizer_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triggered_by    UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- parameters sent to the Python microservice
  parameters      JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"lambda1": 10, "num_reads": 1000, "num_sweeps": 500}
  status          optimizer_run_status NOT NULL DEFAULT 'running',
  -- summary returned by the solver
  result_summary  JSONB DEFAULT NULL,
  -- e.g. {"assigned": 42, "unassigned": 5, "energy": -37.5}
  error_message   TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimizer_runs_status ON optimizer_runs(status);
CREATE INDEX idx_optimizer_runs_triggered_by ON optimizer_runs(triggered_by);

-- ============================================================
-- TABLE: schedules
-- Output of the QUBO model — final assigned appointments
-- ============================================================
CREATE TABLE schedules (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id      UUID NOT NULL UNIQUE REFERENCES appointments_pool(id) ON DELETE CASCADE,
  doctor_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_datetime  TIMESTAMPTZ NOT NULL,
  room                TEXT,
  optimizer_run_id    UUID REFERENCES optimizer_runs(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  completion_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor's daily schedule queries
CREATE INDEX idx_schedules_doctor_datetime ON schedules(doctor_id, scheduled_datetime);
-- Patient lookup via appointments_pool join
CREATE INDEX idx_schedules_appointment ON schedules(appointment_id);
-- Optimizer run trazability
CREATE INDEX idx_schedules_optimizer_run ON schedules(optimizer_run_id);

-- ============================================================
-- FUNCTION: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_doctors_updated_at
  BEFORE UPDATE ON doctors_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pool_updated_at
  BEFORE UPDATE ON appointments_pool
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION + TRIGGER: auto-create public.users on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient')
  );

  -- Si es paciente: crear fila con medical_history estructurado
  IF (COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient') THEN
    INSERT INTO public.patients_data (user_id, medical_history)
    VALUES (
      NEW.id,
      '{
        "blood_type": null,
        "allergies": [],
        "chronic_conditions": [],
        "current_medications": [],
        "previous_surgeries": [],
        "lifestyle": {
          "smoking": false,
          "alcohol": "none",
          "physical_activity": "sedentary",
          "diet": null
        },
        "hereditary_diseases": {
          "diabetes": false,
          "hypertension": false,
          "cancer": false,
          "heart_disease": false,
          "notes": null
        }
      }'::jsonb
    );
  END IF;

  -- If doctor, auto-create empty doctors_data row
  IF (NEW.raw_user_meta_data->>'role' = 'doctor') THEN
    INSERT INTO public.doctors_data (user_id, specialty)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'specialty', 'General')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizer_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role without recursion
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- POLICIES: users table
-- ============================================================
CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (get_my_role() = 'admin');

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (TRUE); -- trigger uses SECURITY DEFINER

-- ============================================================
-- POLICIES: hospitals
-- ============================================================
CREATE POLICY "Hospitals are publicly readable"
  ON hospitals FOR SELECT
  USING (TRUE);

CREATE POLICY "Only admins can manage hospitals"
  ON hospitals FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- POLICIES: patients_data
-- ============================================================
CREATE POLICY "Patients read their own data"
  ON patients_data FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Patients update their own data"
  ON patients_data FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and doctors can read patient data"
  ON patients_data FOR SELECT
  USING (get_my_role() IN ('admin', 'doctor'));

CREATE POLICY "Service role can insert patients_data"
  ON patients_data FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- POLICIES: doctors_data
-- ============================================================
CREATE POLICY "Doctors data is readable by all authenticated users"
  ON doctors_data FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Doctors update their own data"
  ON doctors_data FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage doctors data"
  ON doctors_data FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "Service role can insert doctors_data"
  ON doctors_data FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- POLICIES: appointments_pool
-- ============================================================
CREATE POLICY "Patients see only their own appointments"
  ON appointments_pool FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can create their own appointment requests"
  ON appointments_pool FOR INSERT
  WITH CHECK (patient_id = auth.uid() AND walk_in = FALSE);

CREATE POLICY "Patients can cancel their own pending appointments"
  ON appointments_pool FOR UPDATE
  USING (patient_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "Admins see and manage all appointments"
  ON appointments_pool FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "Doctors can see appointments assigned to them (via schedules)"
  ON appointments_pool FOR SELECT
  USING (
    get_my_role() = 'doctor' AND
    id IN (SELECT appointment_id FROM schedules WHERE doctor_id = auth.uid())
  );

-- ============================================================
-- POLICIES: schedules
-- ============================================================
CREATE POLICY "Doctors see their own schedule"
  ON schedules FOR SELECT
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can update completion status"
  ON schedules FOR UPDATE
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Patients see their assigned schedule"
  ON schedules FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments_pool WHERE patient_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all schedules"
  ON schedules FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- POLICIES: optimizer_runs
-- ============================================================
CREATE POLICY "Admins manage optimizer runs"
  ON optimizer_runs FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "Admins can insert optimizer runs"
  ON optimizer_runs FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- VIEWS — declared with SECURITY INVOKER so they respect the
-- RLS policies of the querying user (not the view creator).
-- Without this, Supabase flags them as SECURITY DEFINER (ERROR).
-- ============================================================

-- Admin overview: pending appointments with patient names and referral info
CREATE VIEW admin_pending_appointments
  WITH (security_invoker = true)
  AS
  SELECT
    ap.id,
    ap.urgency_level,
    ap.requested_specialty,
    ap.symptoms,
    ap.walk_in,
    ap.created_at,
    ap.status,
    ap.referral_source,
    ap.referred_by_doctor,
    u.full_name  AS patient_name,
    u.email      AS patient_email
  FROM appointments_pool ap
  JOIN users u ON ap.patient_id = u.id
  WHERE ap.status = 'pending'
  ORDER BY ap.urgency_level DESC, ap.created_at ASC;

-- Doctor's schedule view with patient details (phone + DNI)
CREATE VIEW doctor_schedule_view
  WITH (security_invoker = true)
  AS
  SELECT
    s.id                    AS schedule_id,
    s.scheduled_datetime,
    s.room,
    s.completed_at,
    ap.urgency_level,
    ap.symptoms,
    ap.requested_specialty,
    u.full_name             AS patient_name,
    pd.phone                AS patient_phone,
    pd.dni                  AS patient_dni,
    s.doctor_id,
    s.appointment_id
  FROM schedules s
  JOIN appointments_pool ap ON s.appointment_id = ap.id
  JOIN users         u  ON ap.patient_id = u.id
  LEFT JOIN patients_data pd ON pd.user_id = u.id;
