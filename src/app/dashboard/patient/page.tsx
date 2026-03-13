import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { PatientDashboardClient } from './PatientDashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PatientDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'patient') redirect('/dashboard/' + profile?.role)

  // Usar service role para evitar recursión infinita de RLS
  // (política de doctores en appointments_pool → schedules → appointments_pool)
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceRoleClient()
    : supabase

  // Fetch patient's appointments with their schedule if exists
  const { data: appointmentsRaw } = await db
    .from('appointments_pool')
    .select(`
      id, urgency_level, requested_specialty, symptoms, status, created_at, walk_in,
      schedules (
        scheduled_datetime, room,
        users!schedules_doctor_id_fkey (full_name)
      )
    `)
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })

  // Normalize the schedules relation (Supabase returns single object or array based on FK cardinality)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appointments = (appointmentsRaw ?? []).map((a: any) => ({
    ...a,
    schedules: a.schedules
      ? (Array.isArray(a.schedules) ? a.schedules : [a.schedules])
      : null,
  }))

  return (
    <PatientDashboardClient
      userName={profile?.full_name ?? user.email ?? 'Paciente'}
      userId={user.id}
      initialAppointments={appointments}
    />
  )
}
