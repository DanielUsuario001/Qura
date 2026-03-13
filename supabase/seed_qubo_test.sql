-- ============================================================
-- SEED: Dataset de prueba para el modelo QUBO — Proyecto Qura
-- Simula un hospital público real (MINSA/EsSalud Lima)
--
-- Contenido:
--   - 1 admin
--   - 8 médicos especialistas (distintas especialidades)
--   - 1 médico general (deriva interconsultas)
--   - 30 pacientes
--   - 40 citas pendientes (mix directo + interconsultas)
--
-- El QUBO recibirá competencia real entre pacientes por slots:
--   - Interconsultas (R_i=10) vs directos (R_i=1)
--   - Urgencias altas vs bajas
--   - Múltiples pacientes por especialidad
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Requiere haber corrido final_schema.sql primero
-- ============================================================

DO $$
DECLARE
  v_instance UUID := '00000000-0000-0000-0000-000000000000';

  -- Admin
  v_admin UUID := gen_random_uuid();

  -- Médicos especialistas
  v_dr_cardio1  UUID := gen_random_uuid();
  v_dr_cardio2  UUID := gen_random_uuid();
  v_dr_neuro    UUID := gen_random_uuid();
  v_dr_traumato UUID := gen_random_uuid();
  v_dr_gastro   UUID := gen_random_uuid();
  v_dr_endocrino UUID := gen_random_uuid();
  v_dr_pneumo   UUID := gen_random_uuid();
  v_dr_dermato  UUID := gen_random_uuid();

  -- Médico general (deriva interconsultas)
  v_dr_general  UUID := gen_random_uuid();

  -- Pacientes (30)
  v_p  UUID[];
  i    INT;

  -- Hospital
  v_hospital UUID;

BEGIN

-- ============================================================
-- 0. Hospital de referencia
-- ============================================================
SELECT id INTO v_hospital FROM hospitals LIMIT 1;

-- ============================================================
-- 1. ADMIN
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin.qubo@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_admin, v_instance, 'authenticated', 'authenticated',
    'admin.qubo@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin QUBO Test","role":"admin"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE public.users SET hospital_id = v_hospital, phone = '01-4567890'
  WHERE id = v_admin;
END IF;

-- ============================================================
-- 2. MÉDICOS ESPECIALISTAS
-- ============================================================

-- Cardiólogo 1
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.cardio1@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_cardio1, v_instance, 'authenticated', 'authenticated',
    'dr.cardio1@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Carlos Mendoza Vega","role":"doctor","specialty":"Cardiología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Cardiología', cmp_license = 'CMP-045321',
    dni = '08234561', phone = '987001001', room_number = 'Cons. 1A',
    max_daily_patients = 14,
    available_slots = '[
      {"day":"monday",    "start_time":"07:00","end_time":"13:00"},
      {"day":"tuesday",   "start_time":"07:00","end_time":"13:00"},
      {"day":"wednesday", "start_time":"07:00","end_time":"13:00"},
      {"day":"thursday",  "start_time":"07:00","end_time":"13:00"},
      {"day":"friday",    "start_time":"07:00","end_time":"12:00"}
    ]'::jsonb
  WHERE user_id = v_dr_cardio1;
END IF;

-- Cardiólogo 2
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.cardio2@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_cardio2, v_instance, 'authenticated', 'authenticated',
    'dr.cardio2@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dra. Lucía Paredes Salas","role":"doctor","specialty":"Cardiología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Cardiología', cmp_license = 'CMP-052108',
    dni = '09345672', phone = '987001002', room_number = 'Cons. 1B',
    max_daily_patients = 12,
    available_slots = '[
      {"day":"monday",    "start_time":"14:00","end_time":"19:00"},
      {"day":"wednesday", "start_time":"14:00","end_time":"19:00"},
      {"day":"friday",    "start_time":"14:00","end_time":"18:00"}
    ]'::jsonb
  WHERE user_id = v_dr_cardio2;
END IF;

-- Neurólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.neuro@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_neuro, v_instance, 'authenticated', 'authenticated',
    'dr.neuro@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Roberto Huanca Quispe","role":"doctor","specialty":"Neurología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Neurología', cmp_license = 'CMP-038744',
    dni = '10456783', phone = '987001003', room_number = 'Cons. 2A',
    max_daily_patients = 10,
    available_slots = '[
      {"day":"tuesday",   "start_time":"08:00","end_time":"14:00"},
      {"day":"thursday",  "start_time":"08:00","end_time":"14:00"},
      {"day":"saturday",  "start_time":"08:00","end_time":"12:00"}
    ]'::jsonb
  WHERE user_id = v_dr_neuro;
END IF;

-- Traumatólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.traumato@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_traumato, v_instance, 'authenticated', 'authenticated',
    'dr.traumato@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Jorge Villanueva Cruz","role":"doctor","specialty":"Traumatología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Traumatología', cmp_license = 'CMP-061237',
    dni = '11567894', phone = '987001004', room_number = 'Cons. 3A',
    max_daily_patients = 16,
    available_slots = '[
      {"day":"monday",    "start_time":"07:00","end_time":"14:00"},
      {"day":"tuesday",   "start_time":"07:00","end_time":"14:00"},
      {"day":"wednesday", "start_time":"07:00","end_time":"14:00"},
      {"day":"thursday",  "start_time":"07:00","end_time":"14:00"},
      {"day":"friday",    "start_time":"07:00","end_time":"13:00"},
      {"day":"saturday",  "start_time":"07:00","end_time":"11:00"}
    ]'::jsonb
  WHERE user_id = v_dr_traumato;
END IF;

-- Gastroenterólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.gastro@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_gastro, v_instance, 'authenticated', 'authenticated',
    'dr.gastro@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dra. Patricia Rios Camargo","role":"doctor","specialty":"Gastroenterología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Gastroenterología', cmp_license = 'CMP-049882',
    dni = '12678905', phone = '987001005', room_number = 'Cons. 4A',
    max_daily_patients = 12,
    available_slots = '[
      {"day":"monday",    "start_time":"08:00","end_time":"13:00"},
      {"day":"wednesday", "start_time":"08:00","end_time":"13:00"},
      {"day":"friday",    "start_time":"08:00","end_time":"13:00"}
    ]'::jsonb
  WHERE user_id = v_dr_gastro;
END IF;

-- Endocrinólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.endocrino@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_endocrino, v_instance, 'authenticated', 'authenticated',
    'dr.endocrino@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dra. Carmen Flores Nieto","role":"doctor","specialty":"Endocrinología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Endocrinología', cmp_license = 'CMP-057341',
    dni = '13789016', phone = '987001006', room_number = 'Cons. 5A',
    max_daily_patients = 10,
    available_slots = '[
      {"day":"tuesday",   "start_time":"09:00","end_time":"14:00"},
      {"day":"thursday",  "start_time":"09:00","end_time":"14:00"}
    ]'::jsonb
  WHERE user_id = v_dr_endocrino;
END IF;

-- Neumólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.pneumo@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_pneumo, v_instance, 'authenticated', 'authenticated',
    'dr.pneumo@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Andrés Ccama Ticona","role":"doctor","specialty":"Neumología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Neumología', cmp_license = 'CMP-043901',
    dni = '14890127', phone = '987001007', room_number = 'Cons. 6A',
    max_daily_patients = 12,
    available_slots = '[
      {"day":"monday",    "start_time":"07:30","end_time":"13:30"},
      {"day":"wednesday", "start_time":"07:30","end_time":"13:30"},
      {"day":"friday",    "start_time":"07:30","end_time":"12:30"}
    ]'::jsonb
  WHERE user_id = v_dr_pneumo;
END IF;

-- Dermatólogo
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.dermato@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_dermato, v_instance, 'authenticated', 'authenticated',
    'dr.dermato@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dra. Valeria Gutierrez Mora","role":"doctor","specialty":"Dermatología"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'Dermatología', cmp_license = 'CMP-066124',
    dni = '15901238', phone = '987001008', room_number = 'Cons. 7A',
    max_daily_patients = 18,
    available_slots = '[
      {"day":"monday",    "start_time":"08:00","end_time":"17:00"},
      {"day":"tuesday",   "start_time":"08:00","end_time":"17:00"},
      {"day":"thursday",  "start_time":"08:00","end_time":"17:00"}
    ]'::jsonb
  WHERE user_id = v_dr_dermato;
END IF;

-- Médico General (origen de las interconsultas)
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.general@qura.test') THEN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change,
    phone_change_token, email_change_token_current,
    email_change_confirm_status, is_sso_user, deleted_at
  ) VALUES (
    v_dr_general, v_instance, 'authenticated', 'authenticated',
    'dr.general@qura.test', crypt('Qura2024!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Miguel Torres Pinto","role":"doctor","specialty":"General"}',
    FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
  );
  UPDATE doctors_data SET
    specialty = 'General', cmp_license = 'CMP-029870',
    dni = '16012349', phone = '987001009', room_number = 'Triaje 1',
    max_daily_patients = 25,
    available_slots = '[
      {"day":"monday",    "start_time":"07:00","end_time":"15:00"},
      {"day":"tuesday",   "start_time":"07:00","end_time":"15:00"},
      {"day":"wednesday", "start_time":"07:00","end_time":"15:00"},
      {"day":"thursday",  "start_time":"07:00","end_time":"15:00"},
      {"day":"friday",    "start_time":"07:00","end_time":"15:00"},
      {"day":"saturday",  "start_time":"07:00","end_time":"12:00"}
    ]'::jsonb
  WHERE user_id = v_dr_general;
END IF;

-- ============================================================
-- 3. PACIENTES (30 pacientes con datos clínicos)
-- ============================================================
-- Generamos los IDs en un array para reutilizarlos en citas
v_p := ARRAY[
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
];

-- Datos de pacientes: (email, full_name, dni, phone, dob, blood, specialty_needed, history_notes)
DECLARE
  patients_data_arr TEXT[][] := ARRAY[
    -- Cardiología (8 pacientes)
    ARRAY['pac01@qura.test','Rosa Mamani Condori',   '44100001','951001001','1962-03-15','A+'],
    ARRAY['pac02@qura.test','Pedro Quispe Huanca',   '44100002','951001002','1958-07-22','O-'],
    ARRAY['pac03@qura.test','Elena Vargas Tito',     '44100003','951001003','1975-11-08','B+'],
    ARRAY['pac04@qura.test','Luis Ccorimanya Apaza', '44100004','951001004','1949-01-30','AB+'],
    ARRAY['pac05@qura.test','Martha Salas Pinedo',   '44100005','951001005','1968-09-12','O+'],
    ARRAY['pac06@qura.test','Julio Medina Ruiz',     '44100006','951001006','1980-04-05','A-'],
    ARRAY['pac07@qura.test','Ana Flores Ccasa',      '44100007','951001007','1955-12-19','B-'],
    ARRAY['pac08@qura.test','Oscar Torres Lima',     '44100008','951001008','1971-06-25','O+'],
    -- Neurología (5 pacientes)
    ARRAY['pac09@qura.test','Sofia Choque Mamani',   '44100009','951001009','1983-02-14','A+'],
    ARRAY['pac10@qura.test','Carlos Huanca Callata', '44100010','951001010','1967-08-03','O+'],
    ARRAY['pac11@qura.test','Ingrid Ponce Quispe',   '44100011','951001011','1990-05-27','B+'],
    ARRAY['pac12@qura.test','Fernando Inca Rojas',   '44100012','951001012','1952-10-16','AB-'],
    ARRAY['pac13@qura.test','Silvia Ramos Cano',     '44100013','951001013','1978-03-09','O-'],
    -- Traumatología (5 pacientes)
    ARRAY['pac14@qura.test','Dante Mamani Ticona',   '44100014','951001014','1995-07-21','A+'],
    ARRAY['pac15@qura.test','Roxana Quispe Lima',    '44100015','951001015','1988-01-14','O+'],
    ARRAY['pac16@qura.test','Pablo Coaquira Tito',   '44100016','951001016','1976-11-30','B+'],
    ARRAY['pac17@qura.test','Nora Apaza Condori',    '44100017','951001017','1961-04-07','AB+'],
    ARRAY['pac18@qura.test','Gabriel Huanca Cruz',   '44100018','951001018','1993-09-18','O-'],
    -- Gastroenterología (3 pacientes)
    ARRAY['pac19@qura.test','Miriam Salas Vargas',   '44100019','951001019','1970-06-22','A-'],
    ARRAY['pac20@qura.test','Raul Ccama Flores',     '44100020','951001020','1959-12-11','B+'],
    ARRAY['pac21@qura.test','Yolanda Medina Inca',   '44100021','951001021','1984-08-04','O+'],
    -- Endocrinología (3 pacientes)
    ARRAY['pac22@qura.test','Teresa Ramos Huanca',   '44100022','951001022','1966-02-28','A+'],
    ARRAY['pac23@qura.test','Ernesto Ponce Mamani',  '44100023','951001023','1974-07-15','AB+'],
    ARRAY['pac24@qura.test','Lidia Choque Torres',   '44100024','951001024','1981-03-03','O+'],
    -- Neumología (3 pacientes)
    ARRAY['pac25@qura.test','Wilfredo Inca Apaza',   '44100025','951001025','1957-10-20','B-'],
    ARRAY['pac26@qura.test','Hilda Coaquira Salas',  '44100026','951001026','1963-05-08','A+'],
    ARRAY['pac27@qura.test','Marco Vargas Quispe',   '44100027','951001027','1987-01-25','O-'],
    -- Dermatología (3 pacientes)
    ARRAY['pac28@qura.test','Lucia Flores Mamani',   '44100028','951001028','1992-09-13','B+'],
    ARRAY['pac29@qura.test','Diego Huanca Ccasa',    '44100029','951001029','1977-04-30','A-'],
    ARRAY['pac30@qura.test','Beatriz Medina Inca',   '44100030','951001030','1969-11-06','O+']
  ];

BEGIN
  FOR i IN 1..30 LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = patients_data_arr[i][1]) THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at,
        confirmation_token, recovery_token,
        email_change_token_new, email_change, phone_change,
        phone_change_token, email_change_token_current,
        email_change_confirm_status, is_sso_user, deleted_at
      ) VALUES (
        v_p[i], v_instance, 'authenticated', 'authenticated',
        patients_data_arr[i][1],
        crypt('Qura2024!', gen_salt('bf')), NOW(),
        '{"provider":"email","providers":["email"]}',
        json_build_object(
          'full_name', patients_data_arr[i][2],
          'role',      'patient'
        )::jsonb,
        FALSE, NOW(), NOW(), '', '', '', '', '', '', '', 0, FALSE, NULL
      );

      UPDATE patients_data SET
        dni           = patients_data_arr[i][3],
        phone         = patients_data_arr[i][4],
        date_of_birth = patients_data_arr[i][5]::DATE,
        medical_history = json_build_object(
          'blood_type',         patients_data_arr[i][6],
          'allergies',          '[]'::jsonb,
          'chronic_conditions', '[]'::jsonb,
          'current_medications','[]'::jsonb,
          'previous_surgeries', '[]'::jsonb,
          'lifestyle', json_build_object(
            'smoking', false, 'alcohol', 'none',
            'physical_activity', 'sedentary', 'diet', null
          ),
          'hereditary_diseases', json_build_object(
            'diabetes', false, 'hypertension', false,
            'cancer', false, 'heart_disease', false, 'notes', null
          )
        )::jsonb
      WHERE user_id = v_p[i];
    END IF;
  END LOOP;
END;

-- ============================================================
-- 4. CITAS PENDIENTES (40 citas para el QUBO)
-- Distribución diseñada para crear COMPETENCIA real entre pacientes:
--   - Múltiples pacientes por especialidad → el QUBO debe priorizar
--   - Mix de referral_source: direct vs doctor_referred
--   - Urgencias variadas para probar los dos ejes del Hamiltoniano
-- ============================================================

-- ── CARDIOLOGÍA (10 citas: 5 directas + 5 interconsultas) ────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id,
  'Cardiología', 9,
  'Dolor en el pecho irradiado al brazo izquierdo, sudoración fría.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac01@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id,
  'Cardiología', 8,
  'Palpitaciones frecuentes, sensación de desmayo al levantarse.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac02@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id,
  'Cardiología', 7,
  'Hipertensión no controlada con 180/110 en control rutinario.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac03@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id,
  'Cardiología', 10,
  'Edema bilateral en miembros inferiores, disnea en reposo. Antecedente de IAM.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac04@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id,
  'Cardiología', 6,
  'Arritmia detectada en EKG de rutina, sin síntomas agudos.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac05@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Cardiología', 3,
  'Chequeo preventivo solicitado por el paciente, sin síntomas actuales.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac06@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Cardiología', 4,
  'Dolor en el pecho leve al subir escaleras, sin otros síntomas.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac07@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Cardiología', 2,
  'Solicita revisión de medicación antihipertensiva actual.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac08@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Cardiología');

-- ── NEUROLOGÍA (8 citas) ──────────────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Neurología', 9,
  'Cefalea intensa de inicio brusco (thunder clap headache), vómitos.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac09@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neurología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Neurología', 8,
  'Episodios de pérdida transitoria de la visión (amaurosis fugaz).',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac10@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neurología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Neurología', 7,
  'Temblor en reposo en mano derecha, bradicinesia. Sospecha Parkinson.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac11@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neurología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Neurología', 5,
  'Cefaleas recurrentes tensionales, sin signos de alarma.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac12@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neurología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Neurología', 3,
  'Hormigueo en miembro superior izquierdo intermitente, sin déficit motor.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac13@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neurología');

-- ── TRAUMATOLOGÍA (8 citas) ───────────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Traumatología', 8,
  'Fractura de radio distal post caída, Rx confirmado en emergencia.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac14@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Traumatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Traumatología', 7,
  'Gonalgia severa post-accidente deportivo, sospecha lesión meniscal.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac15@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Traumatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Traumatología', 5,
  'Lumbalgia crónica, sin irradiación, con limitación funcional moderada.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac16@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Traumatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Traumatología', 4,
  'Cervicobraquialgia leve con parestesias en dedos índice y medio.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac17@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Traumatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Traumatología', 2,
  'Seguimiento post-operatorio de hallux valgus, sin complicaciones.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac18@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Traumatología');

-- ── GASTROENTEROLOGÍA (5 citas) ───────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Gastroenterología', 8,
  'Hematemesis leve, epigastralgia severa. H. pylori positivo en test rápido.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac19@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Gastroenterología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Gastroenterología', 6,
  'Diarrea crónica más de 3 meses, baja de peso de 5 kg. Sospecha EII.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac20@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Gastroenterología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Gastroenterología', 3,
  'Distensión abdominal postprandial, constipación alternada con diarrea (SII).',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac21@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Gastroenterología');

-- ── ENDOCRINOLOGÍA (5 citas) ──────────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Endocrinología', 9,
  'Glucemia en ayunas >400 mg/dl con cetonuria. DM2 descompensada.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac22@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Endocrinología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Endocrinología', 7,
  'Hipotiroidismo sintomático, TSH 45 mUI/L, bradicardia 48 lpm.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac23@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Endocrinología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Endocrinología', 4,
  'Control de DM2 con HbA1c 7.8%, solicita ajuste de metformina.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac24@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Endocrinología');

-- ── NEUMOLOGÍA (5 citas) ──────────────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Neumología', 9,
  'Disnea de esfuerzo progresiva, SpO2 88% en reposo. EPOC severo.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac25@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neumología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Neumología', 7,
  'Tos seca persistente más de 8 semanas, sin respuesta a antihistamínicos.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac26@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neumología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Neumología', 4,
  'Asma leve persistente, solicita espirometría de control anual.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac27@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Neumología');

-- ── DERMATOLOGÍA (5 citas) ────────────────────────────────────────────────────

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, referred_by_doctor, status)
SELECT u.id, 'Dermatología', 8,
  'Lesión melanocítica con cambios ABCDE recientes, diámetro >6mm.',
  'doctor_referred',
  (SELECT id FROM public.users WHERE email = 'dr.general@qura.test'),
  'pending'
FROM public.users u WHERE u.email = 'pac28@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Dermatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Dermatología', 5,
  'Psoriasis en placas en codos y rodillas, con prurito intenso.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac29@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Dermatología');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'Dermatología', 2,
  'Acné moderado, sin respuesta a tratamiento tópico de 3 meses.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac30@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'Dermatología');

END $$;

-- ── MEDICINA GENERAL (6 citas directas) ──────────────────────────────────────
-- Pacientes que acuden directamente sin derivación previa.
-- El Dr. General (Torres Pinto) es el único con specialty='General'
-- y acepta cualquier especialidad, pero aquí los pacientes SOLICITAN 'General'.

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 7,
  'Fiebre de 38.5°C por 4 días, tos seca y malestar general. Sin mejora con paracetamol.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac06@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 6,
  'Dolor abdominal difuso recurrente, náuseas postprandiales y pérdida de 3 kg en 2 semanas.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac08@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 8,
  'Paciente diabético con glicemia en ayunas 320 mg/dL, poliuria y visión borrosa.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac15@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 5,
  'Control de presión arterial. Hipertensión conocida, última visita hace 6 meses.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac17@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 4,
  'Solicitud de certificado médico y renovación de recetas crónicas (metformina, enalapril).',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac19@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

INSERT INTO appointments_pool
  (patient_id, requested_specialty, urgency_level, symptoms, referral_source, status)
SELECT u.id, 'General', 9,
  'Adulto mayor 71 años con confusión aguda, fiebre alta y caída reciente. Posible sepsis urinaria.',
  'direct', 'pending'
FROM public.users u WHERE u.email = 'pac21@qura.test'
  AND NOT EXISTS (SELECT 1 FROM appointments_pool ap WHERE ap.patient_id = u.id AND ap.requested_specialty = 'General');

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT
  'Médicos activos'   AS tipo, COUNT(*)::TEXT AS total FROM doctors_data WHERE is_active = TRUE
UNION ALL
SELECT
  'Pacientes'         AS tipo, COUNT(*)::TEXT FROM patients_data
UNION ALL
SELECT
  'Citas pendientes'  AS tipo, COUNT(*)::TEXT FROM appointments_pool WHERE status = 'pending'
UNION ALL
SELECT
  'Interconsultas'    AS tipo, COUNT(*)::TEXT FROM appointments_pool
  WHERE status = 'pending' AND referral_source = 'doctor_referred'
UNION ALL
SELECT
  'Solicitudes directas' AS tipo, COUNT(*)::TEXT FROM appointments_pool
  WHERE status = 'pending' AND referral_source = 'direct';

-- Distribución por especialidad (para confirmar competencia entre pacientes)
SELECT
  requested_specialty AS especialidad,
  COUNT(*) AS total_citas,
  SUM(CASE WHEN referral_source = 'doctor_referred' THEN 1 ELSE 0 END) AS interconsultas,
  SUM(CASE WHEN referral_source = 'direct'          THEN 1 ELSE 0 END) AS directas,
  ROUND(AVG(urgency_level), 1) AS urgencia_promedio
FROM appointments_pool
WHERE status = 'pending'
GROUP BY requested_specialty
ORDER BY total_citas DESC;
