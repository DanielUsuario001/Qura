import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { DoctorDashboardClient } from './DoctorDashboardClient'
import type { DoctorScheduleEntry } from '@/lib/types'

export default async function DoctorDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'doctor') redirect('/dashboard/' + profile?.role)

  // Fetch doctor's full schedule (upcoming + today)
  const { data: scheduleRaw } = await supabase
    .from('doctor_schedule_view')
    .select('*')
    .eq('doctor_id', user.id)
    .order('scheduled_datetime', { ascending: true })

  const schedule = (scheduleRaw ?? []) as DoctorScheduleEntry[]

  // Doctor's profile data
  const { data: doctorData } = await supabase
    .from('doctors_data')
    .select('specialty, room_number, max_daily_patients')
    .eq('user_id', user.id)
    .single()

  // Stats
  const today = new Date().toISOString().split('T')[0]
  const todaySchedule = schedule.filter(s =>
    s.scheduled_datetime.startsWith(today)
  )
  const completedToday = todaySchedule.filter(s => s.completed_at !== null).length

  return (
    <DoctorDashboardClient
      userName={profile?.full_name ?? user.email ?? 'Doctor'}
      doctorId={user.id}
      specialty={(doctorData as { specialty: string } | null)?.specialty ?? 'General'}
      room={(doctorData as { room_number: string | null } | null)?.room_number ?? null}
      maxDailyPatients={(doctorData as { max_daily_patients: number } | null)?.max_daily_patients ?? 12}
      initialSchedule={schedule}
      todayCount={todaySchedule.length}
      completedToday={completedToday}
    />
  )
}
