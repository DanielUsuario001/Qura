-- ============================================================
-- MIGRATION: Referral Source for QUBO R_i parameter
-- Modelo de referencias MINSA/EsSalud — Proyecto Qura
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create enum type
DO $$ BEGIN
  CREATE TYPE referral_source_type AS ENUM ('direct', 'doctor_referred');
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already exists, skip
END $$;

-- 2. Add referral_source column (R_i: 'direct'=1, 'doctor_referred'=10)
ALTER TABLE appointments_pool
  ADD COLUMN IF NOT EXISTS referral_source    referral_source_type NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS referred_by_doctor UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Index for optimizer queries: pending + referred first
CREATE INDEX IF NOT EXISTS idx_pool_referral
  ON appointments_pool(status, referral_source, urgency_level DESC);

-- 4. RLS: doctors can insert referrals (interconsultas)
-- Notes:
--   • patient_id must belong to an existing patient (not the doctor themselves)
--   • referred_by_doctor must equal auth.uid() to prevent spoofing
--   • referral_source must be 'doctor_referred' (cannot insert 'direct' via this policy)
-- DROP first for idempotency (PostgreSQL has no CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS "Doctors can insert referrals" ON appointments_pool;
CREATE POLICY "Doctors can insert referrals"
  ON appointments_pool FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'doctor'
    AND referral_source = 'doctor_referred'
    AND referred_by_doctor = auth.uid()
    AND patient_id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = patient_id AND role = 'patient')
  );

-- 5. Comment for documentation
COMMENT ON COLUMN appointments_pool.referral_source IS 'Origen: direct=web autoprogramado (R_i=1), doctor_referred=interconsulta MG (R_i=10)';
COMMENT ON COLUMN appointments_pool.referred_by_doctor IS 'Usuario médico general que derivó al especialista (solo si referral_source=doctor_referred)';

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'appointments_pool'
  AND column_name IN ('referral_source', 'referred_by_doctor')
ORDER BY column_name;
