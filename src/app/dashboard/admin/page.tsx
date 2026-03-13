import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AdminDashboardClient } from './AdminDashboardClient'
import type { AdminPendingAppointment } from '@/lib/types'

// Evitar caché: siempre obtener datos frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard/' + profile?.role)

  // Usar service role para datos admin (evita problemas de RLS con get_my_role)
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceRoleClient()
    : supabase

  // Fetch pending appointments with patient data
  const { data: pendingAppointmentsRaw } = await db
    .from('admin_pending_appointments')
    .select('*')
    .order('urgency_level', { ascending: false })

  const pendingAppointments = (pendingAppointmentsRaw ?? []) as AdminPendingAppointment[]

  // Fetch optimizer run history
  const { data: optimizerRunsRaw } = await db
    .from('optimizer_runs')
    .select('id, run_at, status, result_summary, triggered_by, duration_ms')
    .order('run_at', { ascending: false })
    .limit(10)

  const optimizerRuns = (optimizerRunsRaw ?? []).map(r => ({
    ...r,
    result_summary: r.result_summary as Record<string, number> | null,
  }))

  // Fetch scheduled appointments for calendar view
  const { data: scheduledRaw } = await db
    .from('schedules')
    .select(`
      id, scheduled_datetime, room, completed_at, doctor_id, appointment_id,
      appointments_pool!schedules_appointment_id_fkey (
        requested_specialty, urgency_level,
        users!appointments_pool_patient_id_fkey ( full_name )
      ),
      users!schedules_doctor_id_fkey ( full_name )
    `)
    .order('scheduled_datetime', { ascending: true })
    .limit(300)

  type ScheduledRaw = {
    id: string
    scheduled_datetime: string
    room: string | null
    completed_at: string | null
    doctor_id: string
    appointments_pool: {
      requested_specialty: string
      urgency_level: number
      users: { full_name: string } | null
    } | null
    users: { full_name: string } | null
  }

  const scheduledAppointments = (scheduledRaw ?? []).map((s) => {
    const row = s as unknown as ScheduledRaw
    return {
      id: row.id,
      scheduled_datetime: row.scheduled_datetime,
      room: row.room,
      completed_at: row.completed_at,
      doctor_name: row.users?.full_name ?? '—',
      patient_name: row.appointments_pool?.users?.full_name ?? '—',
      specialty: row.appointments_pool?.requested_specialty ?? '—',
      urgency_level: row.appointments_pool?.urgency_level ?? 0,
    }
  })

  // Fetch metrics
  const [
    { count: totalPending },
    { count: totalScheduled },
    { count: completedToday },
  ] = await Promise.all([
    db.from('appointments_pool').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('appointments_pool').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    db.from('schedules').select('*', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date().toISOString().split('T')[0]),
  ])

  return (
    <AdminDashboardClient
      userName={profile?.full_name ?? user.email ?? 'Admin'}
      adminId={user.id}
      initialPendingAppointments={pendingAppointments}
      initialOptimizerRuns={optimizerRuns}
      initialScheduledAppointments={scheduledAppointments}
      metrics={{
        totalPending: totalPending ?? 0,
        totalScheduled: totalScheduled ?? 0,
        completedToday: completedToday ?? 0,
      }}
    />
  )
}
