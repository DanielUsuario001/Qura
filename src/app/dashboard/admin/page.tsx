import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AdminDashboardClient } from './AdminDashboardClient'
import type { AdminPendingAppointment } from '@/lib/types'

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

  // Fetch pending appointments with patient data
  const { data: pendingAppointmentsRaw } = await supabase
    .from('admin_pending_appointments')
    .select('*')
    .order('urgency_level', { ascending: false })

  const pendingAppointments = (pendingAppointmentsRaw ?? []) as AdminPendingAppointment[]

  // Fetch optimizer run history
  const { data: optimizerRunsRaw } = await supabase
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
    supabase.from('appointments_pool').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('appointments_pool').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('schedules').select('*', { count: 'exact', head: true })
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
