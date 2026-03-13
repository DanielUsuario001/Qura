-- ============================================================
-- MIGRATION: Clinical Fields — Proyecto Qura
-- Agrega phone/DNI a médicos, phone a usuarios, estructura
-- completa de medical_history, y actualiza vistas y trigger.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. users — agregar phone general
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN users.phone IS 'Teléfono de contacto general del usuario (pacientes, médicos, admins)';

-- ============================================================
-- 2. patients_data — agregar columna phone dedicada
-- ============================================================
ALTER TABLE patients_data
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN patients_data.phone IS 'Teléfono directo del paciente (columna dedicada, más rápida de consultar que contact_info JSONB)';

-- ============================================================
-- 3. doctors_data — agregar DNI y phone
-- ============================================================
ALTER TABLE doctors_data
  ADD COLUMN IF NOT EXISTS dni   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN doctors_data.dni   IS 'DNI del médico (documento nacional de identidad)';
COMMENT ON COLUMN doctors_data.phone IS 'Teléfono de contacto del médico';

-- ============================================================
-- 4. patients_data — actualizar DEFAULT de medical_history
--    y migrar filas vacías al esquema estructurado
-- ============================================================

-- Nuevo default estructurado para filas futuras
ALTER TABLE patients_data
  ALTER COLUMN medical_history
    SET DEFAULT '{
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
    }'::jsonb;

-- Migrar filas existentes que tienen medical_history = '{}'
-- (sin datos clínicos reales) al nuevo esquema estructurado.
-- Filas con datos existentes no se tocan.
UPDATE patients_data
SET medical_history = '{
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
WHERE medical_history = '{}'::jsonb;

-- ============================================================
-- 5. Actualizar trigger handle_new_user
--    Inicializa medical_history con estructura completa
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

  -- Si es médico: crear fila con specialty desde metadata
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

-- ============================================================
-- 6. Actualizar vistas (DROP + CREATE para idempotencia)
-- ============================================================

-- 6a. admin_pending_appointments
--     Agrega referral_source y referred_by_doctor
DROP VIEW IF EXISTS admin_pending_appointments;

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

-- 6b. doctor_schedule_view
--     Agrega patient_phone (patients_data.phone) y patient_dni
DROP VIEW IF EXISTS doctor_schedule_view;

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

-- ============================================================
-- Verificación
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('users', 'patients_data', 'doctors_data')
  AND column_name IN ('phone', 'dni')
ORDER BY table_name, column_name;
