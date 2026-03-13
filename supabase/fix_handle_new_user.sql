-- ============================================================
-- FIX: "Database error saving new user"
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El error ocurre cuando el trigger handle_new_user falla al insertar
-- en public.users/patients_data. Esta corrección:
-- 1. Define search_path explícito (evita fallos en contexto auth)
-- 2. Garantiza que la función pueda insertar correctamente
-- ============================================================

-- Eliminar trigger y función existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recrear la función con search_path explícito
-- (Supabase recomienda esto para triggers en auth.users)
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

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Asegurar que postgres puede ejecutar la función
-- (por si el propietario cambió)
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO supabase_auth_admin;
