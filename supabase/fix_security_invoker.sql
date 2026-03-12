-- ============================================================
-- FIX: Security Definer Views → Security Invoker
-- Run this in Supabase SQL Editor if you already executed
-- schema.sql and got the SECURITY DEFINER lint errors.
--
-- SECURITY INVOKER ensures the view respects the RLS policies
-- of the querying user, not the view creator (superuser).
-- ============================================================

-- Drop and recreate admin_pending_appointments with SECURITY INVOKER
DROP VIEW IF EXISTS public.admin_pending_appointments;

CREATE VIEW public.admin_pending_appointments
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
    u.full_name  AS patient_name,
    u.email      AS patient_email
  FROM appointments_pool ap
  JOIN users u ON ap.patient_id = u.id
  WHERE ap.status = 'pending'
  ORDER BY ap.urgency_level DESC, ap.created_at ASC;

-- Drop and recreate doctor_schedule_view with SECURITY INVOKER
DROP VIEW IF EXISTS public.doctor_schedule_view;

CREATE VIEW public.doctor_schedule_view
  WITH (security_invoker = true)
  AS
  SELECT
    s.id               AS schedule_id,
    s.scheduled_datetime,
    s.room,
    s.completed_at,
    ap.urgency_level,
    ap.symptoms,
    ap.requested_specialty,
    u.full_name        AS patient_name,
    s.doctor_id,
    s.appointment_id
  FROM schedules s
  JOIN appointments_pool ap ON s.appointment_id = ap.id
  JOIN users u ON ap.patient_id = u.id;
