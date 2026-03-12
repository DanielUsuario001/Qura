/**
 * POST /api/seed
 * Creates 3 test accounts (patient, doctor, admin) using the Supabase Admin API.
 * Only works when SUPABASE_SERVICE_ROLE_KEY is set.
 * DELETE this file before going to production.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const TEST_USERS = [
  {
    email: 'paciente@qura.test',
    password: 'Qura2024!',
    full_name: 'María González Ríos',
    role: 'patient',
  },
  {
    email: 'doctor@qura.test',
    password: 'Qura2024!',
    full_name: 'Dr. Carlos Mendoza Vega',
    role: 'doctor',
    specialty: 'Cardiología',
  },
  {
    email: 'admin@qura.test',
    password: 'Qura2024!',
    full_name: 'Ana Supervisora Torres',
    role: 'admin',
  },
]

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  // Admin client bypasses RLS and can create auth users
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const results: Record<string, string> = {}

  for (const user of TEST_USERS) {
    // Check if user already exists
    const { data: existing } = await adminClient
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (existing) {
      results[user.email] = 'already exists'
      continue
    }

    // Create auth user (triggers handle_new_user → inserts into public.users)
    const { data, error } = await adminClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,    // skip email confirmation for test accounts
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
        ...(user.role === 'doctor' ? { specialty: (user as typeof user & { specialty?: string }).specialty } : {}),
      },
    })

    if (error) {
      results[user.email] = `ERROR: ${error.message}`
      continue
    }

    // For doctors: update the doctors_data row with extra info
    if (user.role === 'doctor' && data.user) {
      await adminClient
        .from('doctors_data')
        .update({
          specialty: (user as typeof user & { specialty?: string }).specialty ?? 'General',
          room_number: 'Consultorio 3A',
          max_daily_patients: 10,
          available_slots: [
            { day: 'monday',    start_time: '08:00', end_time: '13:00' },
            { day: 'tuesday',   start_time: '08:00', end_time: '13:00' },
            { day: 'wednesday', start_time: '08:00', end_time: '13:00' },
            { day: 'thursday',  start_time: '08:00', end_time: '13:00' },
            { day: 'friday',    start_time: '08:00', end_time: '12:00' },
          ],
        })
        .eq('user_id', data.user.id)
    }

    results[user.email] = 'created'
  }

  const allOk = Object.values(results).every(r => r === 'created' || r === 'already exists')

  return NextResponse.json({
    success: allOk,
    results,
    credentials: TEST_USERS.map(u => ({
      email: u.email,
      password: u.password,
      role: u.role,
    })),
    message: allOk
      ? 'Test users ready. Go to /auth/login and use the credentials above.'
      : 'Some users had errors. Check results.',
  })
}
