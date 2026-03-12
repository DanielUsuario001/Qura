import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type {
  OptimizerPatientInput,
  OptimizerDoctorInput,
  OptimizerRequest,
  OptimizerResponse,
  OptimizerParameters,
  AvailableSlot,
} from '@/lib/types'

const OPTIMIZER_URL = process.env.OPTIMIZER_SERVICE_URL ?? 'http://localhost:8000'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Auth check — only admins can trigger optimization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
  }

  // Parse parameters from request body
  const body = await request.json().catch(() => ({}))
  const parameters: OptimizerParameters = {
    lambda1:    body.parameters?.lambda1    ?? 50,
    lambda2:    body.parameters?.lambda2    ?? 50,
    lambda4:    body.parameters?.lambda4    ?? 20,
    num_reads:  body.parameters?.num_reads  ?? 1000,
    num_sweeps: body.parameters?.num_sweeps ?? 500,
  }

  // ── 1. Create optimizer run record ───────────────────────
  const { data: runRecord, error: runInsertError } = await supabase
    .from('optimizer_runs')
    .insert({
      triggered_by: user.id,
      parameters: parameters as unknown as import('@/lib/database.types').Json,
      status: 'running' as const,
    })
    .select('id')
    .single()

  if (runInsertError || !runRecord) {
    return NextResponse.json({ error: 'Failed to create optimizer run record' }, { status: 500 })
  }

  const optimizerRunId = (runRecord as { id: string }).id
  const startTime = Date.now()

  try {
    // ── 2. Fetch pending appointments ──────────────────────
    const { data: pendingAppointments, error: apptError } = await supabase
      .from('appointments_pool')
      .select('id, patient_id, urgency_level, requested_specialty, referral_source')
      .eq('status', 'pending')
      .order('referral_source', { ascending: true })   // doctor_referred sorts before direct
      .order('urgency_level', { ascending: false })

    if (apptError) throw new Error(`Failed to fetch appointments: ${apptError.message}`)

    if (!pendingAppointments || pendingAppointments.length === 0) {
      await supabase.from('optimizer_runs').update({
        status: 'completed',
        duration_ms: Date.now() - startTime,
        result_summary: { assigned: 0, unassigned: 0, energy: 0 },
      }).eq('id', optimizerRunId)

      return NextResponse.json({
        message: 'No pending appointments to optimize.',
        summary: { assigned: 0, unassigned: 0, energy: 0 },
      })
    }

    // ── 3. Fetch active doctors with availability ──────────
    const { data: doctors, error: docError } = await supabase
      .from('doctors_data')
      .select(`
        user_id, specialty, available_slots, room_number, max_daily_patients,
        users!doctors_data_user_id_fkey (id)
      `)
      .eq('is_active', true)

    if (docError) throw new Error(`Failed to fetch doctors: ${docError.message}`)

    if (!doctors || doctors.length === 0) {
      throw new Error('No active doctors available for scheduling')
    }

    // ── 4. Build optimizer payload ─────────────────────────
    // Map referral_source → R_i multiplier for the QUBO model
    // 'doctor_referred' = GP interconsulta → R_i = 10 (absolute mathematical priority)
    // 'direct'          = patient self-scheduled → R_i = 1
    const REFERRAL_MULTIPLIER: Record<string, number> = {
      doctor_referred: 10,
      direct:          1,
    }

    const patients: OptimizerPatientInput[] = pendingAppointments.map(a => ({
      id:                  a.id,
      urgency:             a.urgency_level,
      specialty:           a.requested_specialty,
      referral_multiplier: REFERRAL_MULTIPLIER[(a as { referral_source?: string }).referral_source ?? 'direct'] ?? 1,
    }))

    const doctorInputs: OptimizerDoctorInput[] = doctors.map(d => ({
      id: d.user_id,
      specialty: d.specialty,
      available_slots: (d.available_slots as unknown as AvailableSlot[]) ?? [],
      max_daily_patients: d.max_daily_patients,
      room_number: d.room_number,
    }))

    const optimizerRequest: OptimizerRequest = {
      patients,
      doctors: doctorInputs,
      parameters,
      optimizer_run_id: optimizerRunId,
    }

    // ── 5. Call Python microservice ────────────────────────
    const solverResponse = await fetch(`${OPTIMIZER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(optimizerRequest),
      signal: AbortSignal.timeout(120_000), // 2 min timeout for large problems
    })

    if (!solverResponse.ok) {
      const errText = await solverResponse.text()
      throw new Error(`Optimizer service error (${solverResponse.status}): ${errText}`)
    }

    const optimizerResult: OptimizerResponse = await solverResponse.json()
    const { assignments, summary } = optimizerResult

    // ── 6. Persist assignments to schedules table ──────────
    if (assignments.length > 0) {
      const scheduleInserts = assignments.map(a => ({
        appointment_id: a.patient_id,  // patient_id here is actually appointment_id
        doctor_id: a.doctor_id,
        scheduled_datetime: a.time_slot,
        room: a.room,
        optimizer_run_id: optimizerRunId,
      }))

      const { error: schedInsertErr } = await supabase
        .from('schedules')
        .upsert(scheduleInserts, { onConflict: 'appointment_id' })

      if (schedInsertErr) throw new Error(`Failed to save schedules: ${schedInsertErr.message}`)

      // Update appointment statuses to 'scheduled'
      const appointmentIds = assignments.map(a => a.patient_id)
      await supabase
        .from('appointments_pool')
        .update({ status: 'scheduled' })
        .in('id', appointmentIds)
    }

    // ── 7. Update optimizer run as completed ───────────────
    const durationMs = Date.now() - startTime
    await supabase.from('optimizer_runs').update({
      status: 'completed' as const,
      result_summary: summary as unknown as import('@/lib/database.types').Json,
      duration_ms: durationMs,
    }).eq('id', optimizerRunId)

    return NextResponse.json({
      optimizer_run_id: optimizerRunId,
      summary,
      assignments_count: assignments.length,
    })

  } catch (error) {
    // Mark run as failed
    const errMessage = error instanceof Error ? error.message : String(error)
    await supabase.from('optimizer_runs').update({
      status: 'failed' as const,
      error_message: errMessage,
      duration_ms: Date.now() - startTime,
    }).eq('id', optimizerRunId)

    console.error('[/api/optimize] Error:', errMessage)
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
