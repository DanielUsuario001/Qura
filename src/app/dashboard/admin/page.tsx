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
      metrics={{
        totalPending: totalPending ?? 0,
        totalScheduled: totalScheduled ?? 0,
        completedToday: completedToday ?? 0,
      }}
    />
  )
}
