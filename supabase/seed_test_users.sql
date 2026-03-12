-- ============================================================
-- SEED: Usuarios de prueba para Quantum Health Scheduler
-- Ejecutar en: Supabase SQL Editor
--
-- Crea 3 usuarios en auth.users con email ya confirmado.
-- El trigger handle_new_user() crea automáticamente los
-- registros en public.users, patients_data y doctors_data.
--
-- Credenciales de prueba:
--   paciente@qura.test  /  Qura2024!
--   doctor@qura.test    /  Qura2024!
--   admin@qura.test     /  Qura2024!
-- ============================================================

DO $$
DECLARE
  v_patient_id  UUID := gen_random_uuid();
  v_doctor_id   UUID := gen_random_uuid();
  v_admin_id    UUID := gen_random_uuid();
  v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

-- ── 1. PACIENTE ───────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change,
  phone_change, phone_change_token,
  email_change_token_current, email_change_confirm_status,
  is_sso_user, deleted_at
)
VALUES (
  v_patient_id, v_instance_id, 'authenticated', 'authenticated',
  'paciente@qura.test',
  crypt('Qura2024!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"María González Ríos","role":"patient"}',
  FALSE, NOW(), NOW(),
  '', '', '', '', '', '', '', 0, FALSE, NULL
)
ON CONFLICT (email) DO NOTHING;

-- ── 2. DOCTOR ────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change,
  phone_change, phone_change_token,
  email_change_token_current, email_change_confirm_status,
  is_sso_user, deleted_at
)
VALUES (
  v_doctor_id, v_instance_id, 'authenticated', 'authenticated',
  'doctor@qura.test',
  crypt('Qura2024!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dr. Carlos Mendoza Vega","role":"doctor","specialty":"Cardiología"}',
  FALSE, NOW(), NOW(),
  '', '', '', '', '', '', '', 0, FALSE, NULL
)
ON CONFLICT (email) DO NOTHING;

-- ── 3. ADMIN ─────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change,
  phone_change, phone_change_token,
  email_change_token_current, email_change_confirm_status,
  is_sso_user, deleted_at
)
VALUES (
  v_admin_id, v_instance_id, 'authenticated', 'authenticated',
  'admin@qura.test',
  crypt('Qura2024!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ana Supervisora Torres","role":"admin"}',
  FALSE, NOW(), NOW(),
  '', '', '', '', '', '', '', 0, FALSE, NULL
)
ON CONFLICT (email) DO NOTHING;

END $$;

-- ── 4. Enriquecer datos del doctor ────────────────────────────
-- (Recuperamos el id real por email por si el DO NOTHING actuó)
UPDATE doctors_data
SET
  specialty          = 'Cardiología',
  room_number        = 'Consultorio 3A',
  max_daily_patients = 10,
  cmp_license        = 'CMP-045321',
  available_slots    = '[
    {"day":"monday",    "start_time":"08:00","end_time":"13:00"},
    {"day":"tuesday",   "start_time":"08:00","end_time":"13:00"},
    {"day":"wednesday", "start_time":"08:00","end_time":"13:00"},
    {"day":"thursday",  "start_time":"08:00","end_time":"13:00"},
    {"day":"friday",    "start_time":"08:00","end_time":"12:00"}
  ]'::jsonb
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'doctor@qura.test'
);

-- ── 5. Enriquecer datos del paciente ──────────────────────────
UPDATE patients_data
SET
  date_of_birth  = '1990-05-14',
  dni            = '45678912',
  contact_info   = '{"phone":"987654321","address":"Av. La Marina 2345, San Miguel, Lima"}'::jsonb,
  medical_history = '{"blood_type":"O+","allergies":["penicilina"],"chronic_conditions":[]}'::jsonb
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'paciente@qura.test'
);

-- ── 6. Agregar una cita de prueba en la cola ──────────────────
INSERT INTO appointments_pool (
  patient_id,
  requested_specialty,
  urgency_level,
  symptoms,
  status
)
SELECT
  id,
  'Cardiología',
  8,
  'Dolor en el pecho al hacer esfuerzo, dificultad para respirar desde hace 3 días.',
  'pending'
FROM public.users
WHERE email = 'paciente@qura.test'
ON CONFLICT DO NOTHING;

-- ── 7. Verificación final ─────────────────────────────────────
SELECT
  u.email,
  u.full_name,
  u.role,
  CASE u.role
    WHEN 'patient' THEN (SELECT dni FROM patients_data WHERE user_id = u.id)
    WHEN 'doctor'  THEN (SELECT specialty FROM doctors_data WHERE user_id = u.id)
    ELSE 'N/A'
  END AS extra_info
FROM public.users u
WHERE u.email IN ('paciente@qura.test', 'doctor@qura.test', 'admin@qura.test')
ORDER BY u.role;
