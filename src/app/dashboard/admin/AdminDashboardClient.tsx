'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { AdminPendingAppointment } from '@/lib/types'

export interface ScheduledAppointment {
  id: string
  appointment_id: string
  scheduled_datetime: string
  room: string | null
  completed_at: string | null
  doctor_name: string
  patient_name: string
  specialty: string
  urgency_level: number
}

const SPECIALTIES = [
  'Cardiología', 'Neurología', 'Pediatría', 'Traumatología',
  'Ginecología', 'Medicina Interna', 'Cirugía General',
  'Oftalmología', 'Dermatología', 'Psiquiatría', 'General',
]

interface OptimizerRunRow {
  id: string
  run_at: string
  status: string
  result_summary: Record<string, unknown> | null
  triggered_by: string
  duration_ms: number | null
}

interface Props {
  userName: string
  adminId: string
  initialPendingAppointments: AdminPendingAppointment[]
  initialOptimizerRuns: OptimizerRunRow[]
  initialScheduledAppointments: ScheduledAppointment[]
  metrics: { totalPending: number; totalScheduled: number; completedToday: number }
}

const navItems = [
  {
    label: 'Panel de Control',
    href: '/dashboard/admin',
    icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
  },
]

const STATUS_RUN_CONFIG = {
  running:   { label: 'Ejecutando',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  completed: { label: 'Completado',  color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  failed:    { label: 'Error',       color: 'bg-red-500/10 text-red-400 border-red-500/30' },
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6) // 06:00 → 19:00 UTC

const SPECIALTY_COLORS: Record<string, string> = {
  'Cardiología':      'bg-red-500/20 border-red-500/40 text-red-300',
  'Neurología':       'bg-purple-500/20 border-purple-500/40 text-purple-300',
  'Traumatología':    'bg-orange-500/20 border-orange-500/40 text-orange-300',
  'Neumología':       'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  'Gastroenterología':'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  'Dermatología':     'bg-pink-500/20 border-pink-500/40 text-pink-300',
  'Endocrinología':   'bg-lime-500/20 border-lime-500/40 text-lime-300',
  'Pediatría':        'bg-green-500/20 border-green-500/40 text-green-300',
  'Ginecología':      'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300',
  'Oftalmología':     'bg-teal-500/20 border-teal-500/40 text-teal-300',
}
const DEFAULT_COLOR = 'bg-sky-500/20 border-sky-500/40 text-sky-300'

export function AdminDashboardClient({
  userName, adminId, initialPendingAppointments, initialOptimizerRuns, initialScheduledAppointments, metrics
}: Props) {
  const [pendingAppointments, setPendingAppointments] = useState(initialPendingAppointments)
  const [optimizerRuns, setOptimizerRuns] = useState(initialOptimizerRuns)
  const [scheduledAppointments, setScheduledAppointments] = useState(initialScheduledAppointments)
  const [filterUrgency, setFilterUrgency] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [showWalkIn, setShowWalkIn] = useState(false)

  // Calendar state
  const [calendarView, setCalendarView] = useState<'agenda' | 'pending'>('pending')

  // Group scheduled appointments by date (using UTC date to match optimizer slots)
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, ScheduledAppointment[]>()
    for (const appt of scheduledAppointments) {
      const dt = new Date(appt.scheduled_datetime)
      // Use UTC date so days match how the optimizer stored them
      const date = dt.toISOString().slice(0, 10)
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(appt)
    }
    return map
  }, [scheduledAppointments])

  const calendarDates = useMemo(() =>
    Array.from(appointmentsByDate.keys()).sort(), [appointmentsByDate])

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    calendarDates[0] ?? new Date().toISOString().slice(0, 10)
  )

  // Walk-in form state
  const [wiSpecialty, setWiSpecialty] = useState('General')
  const [wiUrgency, setWiUrgency] = useState(7)
  const [wiSymptoms, setWiSymptoms] = useState('')
  const [wiPatientEmail, setWiPatientEmail] = useState('')
  const [wiSubmitting, setWiSubmitting] = useState(false)
  const [wiError, setWiError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleRunOptimizer() {
    setRunning(true)
    setRunResult(null)

    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: { lambda1: 10, lambda2: 10, num_reads: 1000, num_sweeps: 500 }
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setRunResult(`Error: ${result.error ?? 'Fallo en la optimización'}`)
      } else {
        const summary = result.summary
        setRunResult(
          `Optimización completada: ${summary?.assigned ?? 0} citas asignadas, ${summary?.unassigned ?? 0} sin asignar. Energía: ${summary?.energy?.toFixed(2) ?? '—'}`
        )
        // Refresh runs list
        const { data: newRuns } = await supabase
          .from('optimizer_runs')
          .select('id, run_at, status, result_summary, triggered_by, duration_ms')
          .order('run_at', { ascending: false })
          .limit(10)
        if (newRuns) setOptimizerRuns(newRuns.map(r => ({
          ...r,
          result_summary: r.result_summary as Record<string, number> | null,
        })))

        // Remove newly scheduled appointments from pending view
        const { data: stillPending } = await supabase
          .from('admin_pending_appointments')
          .select('*')
          .order('urgency_level', { ascending: false })
        if (stillPending) setPendingAppointments(stillPending as import('@/lib/types').AdminPendingAppointment[])

        // Refresh calendar — reload page to get service-role scheduled data
        window.location.reload()
      }
    } catch {
      setRunResult('Error de red: no se pudo conectar con el microservicio.')
    }

    setRunning(false)
  }

  async function handleMarkComplete(scheduleId: string, appointmentId: string) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('schedules')
      .update({ completed_at: now })
      .eq('id', scheduleId)

    if (!error) {
      await supabase
        .from('appointments_pool')
        .update({ status: 'completed' })
        .eq('id', appointmentId)

      setScheduledAppointments(prev =>
        prev.map(s => s.id === scheduleId ? { ...s, completed_at: now } : s)
      )
    }
  }

  async function handleWalkInSubmit(e: React.FormEvent) {
    e.preventDefault()
    setWiSubmitting(true)
    setWiError(null)

    // Find patient by email
    const { data: patientUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', wiPatientEmail)
      .eq('role', 'patient')
      .single()

    if (!patientUser) {
      setWiError('No se encontró un paciente con ese correo.')
      setWiSubmitting(false)
      return
    }

    const { error } = await supabase
      .from('appointments_pool')
      .insert({
        patient_id: (patientUser as { id: string }).id,
        requested_specialty: wiSpecialty,
        urgency_level: wiUrgency,
        symptoms: wiSymptoms || null,
        walk_in: true,
        inserted_by_admin: adminId,
      })

    if (error) {
      setWiError(error.message)
      setWiSubmitting(false)
      return
    }

    // Refresh pending list
    const { data: updatedPending } = await supabase
      .from('admin_pending_appointments')
      .select('*')
      .order('urgency_level', { ascending: false })
    if (updatedPending) setPendingAppointments(updatedPending as import('@/lib/types').AdminPendingAppointment[])

    setShowWalkIn(false)
    setWiSpecialty('General')
    setWiUrgency(7)
    setWiSymptoms('')
    setWiPatientEmail('')
    setWiSubmitting(false)
  }

  const filteredAppointments = pendingAppointments.filter(a => {
    if (filterUrgency !== null && a.urgency_level < filterUrgency) return false
    return true
  })

  return (
    <DashboardLayout role="admin" userName={userName} navItems={navItems}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
            <p className="text-slate-400 mt-1">Gestión hospitalaria y optimización cuántica de agendas</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Walk-in
            </button>
            <button
              onClick={handleRunOptimizer}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm shadow-lg shadow-sky-900/30"
            >
              {running ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Procesando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Ejecutar Optimización Cuántica
                </>
              )}
            </button>
          </div>
        </div>

        {/* Run result banner */}
        {runResult && (
          <div className={`mb-6 flex items-start gap-3 px-5 py-4 rounded-xl border ${runResult.startsWith('Error') ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-green-500/10 border-green-500/30 text-green-300'}`}>
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {runResult.startsWith('Error') ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <p className="text-sm">{runResult}</p>
            <button onClick={() => setRunResult(null)} className="ml-auto text-slate-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            {
              label: 'Pendientes de asignar',
              value: metrics.totalPending,
              color: 'text-amber-400',
              bg: 'bg-amber-400/10 border-amber-400/20',
              icon: (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: 'Citas programadas',
              value: metrics.totalScheduled,
              color: 'text-sky-400',
              bg: 'bg-sky-400/10 border-sky-400/20',
              icon: (
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              ),
            },
            {
              label: 'Completadas hoy',
              value: metrics.completedToday,
              color: 'text-emerald-400',
              bg: 'bg-emerald-400/10 border-emerald-400/20',
              icon: (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((m) => (
            <div key={m.label} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-sky-900/60 transition">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border mb-3 ${m.bg}`}>
                {m.icon}
              </div>
              <p className="text-slate-400 text-sm mb-1">{m.label}</p>
              <p className={`text-3xl font-bold tracking-tight ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Pending appointments table */}
          <div className="col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Cola de Citas Pendientes</h2>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Urgencia mín.:</span>
                <select
                  value={filterUrgency ?? ''}
                  onChange={(e) => setFilterUrgency(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {[1,3,5,7,8].map(v => <option key={v} value={v}>{v}+</option>)}
                </select>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">No hay citas pendientes</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Paciente</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Especialidad</th>
                      <th className="text-center px-4 py-3 text-slate-400 font-medium">Urgencia</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Registrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appt, idx) => (
                      <tr key={appt.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${idx % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{appt.patient_name}</p>
                          <p className="text-slate-500 text-xs">{appt.patient_email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{appt.requested_specialty}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            appt.urgency_level >= 8 ? 'bg-red-500/20 text-red-400' :
                            appt.urgency_level >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {appt.urgency_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(appt.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Optimizer run history */}
          <div className="col-span-2">
            <h2 className="text-white font-semibold text-lg mb-4">Historial de Optimizaciones</h2>
            <div className="space-y-3">
              {optimizerRuns.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <p className="text-slate-500 text-sm">Sin ejecuciones previas</p>
                </div>
              ) : (
                optimizerRuns.map((run) => {
                  const cfg = STATUS_RUN_CONFIG[run.status as keyof typeof STATUS_RUN_CONFIG] ?? STATUS_RUN_CONFIG.completed
                  const summary = run.result_summary as Record<string, number> | null
                  return (
                    <div key={run.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {new Date(run.run_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {summary && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                          <span className="text-slate-400">Asignadas: <span className="text-green-400 font-medium">{summary.assigned}</span></span>
                          <span className="text-slate-400">Sin asignar: <span className="text-yellow-400 font-medium">{summary.unassigned}</span></span>
                          {summary.energy !== undefined && (
                            <span className="text-slate-400 col-span-2">Energía QUBO: <span className="text-sky-400 font-mono">{Number(summary.energy).toFixed(3)}</span></span>
                          )}
                        </div>
                      )}
                      {run.duration_ms && (
                        <p className="text-slate-600 text-xs mt-2">{(run.duration_ms / 1000).toFixed(1)}s</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Agenda / Calendar View ───────────────────────── */}
        <div className="mt-8">
          {/* Tab selector */}
          <div className="flex items-center gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
            <button
              onClick={() => setCalendarView('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${calendarView === 'pending' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Cola Pendiente
            </button>
            <button
              onClick={() => setCalendarView('agenda')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${calendarView === 'agenda' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Agenda por Día
              {scheduledAppointments.length > 0 && (
                <span className="bg-sky-600 text-white text-xs px-1.5 py-0.5 rounded-full">{scheduledAppointments.length}</span>
              )}
            </button>
          </div>

          {calendarView === 'agenda' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {scheduledAppointments.length === 0 ? (
                <div className="text-center py-16">
                  <svg className="w-10 h-10 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <p className="text-slate-500 text-sm">No hay citas programadas aún. Ejecuta la optimización cuántica para asignar citas.</p>
                </div>
              ) : (
                <>
                  {/* Day selector */}
                  <div className="flex gap-1 p-3 border-b border-slate-800 overflow-x-auto">
                    {calendarDates.map(date => {
                      const d = new Date(date + 'T12:00:00')
                      const count = appointmentsByDate.get(date)?.length ?? 0
                      const isSelected = date === selectedDate
                      return (
                        <button
                          key={date}
                          onClick={() => setSelectedDate(date)}
                          className={`flex flex-col items-center px-4 py-2 rounded-lg min-w-[70px] transition ${
                            isSelected ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-medium uppercase">
                            {d.toLocaleDateString('es-PE', { weekday: 'short' })}
                          </span>
                          <span className="text-xl font-bold leading-tight">{d.getDate()}</span>
                          <span className="text-xs opacity-70">
                            {d.toLocaleDateString('es-PE', { month: 'short' })}
                          </span>
                          <span className={`mt-1 text-xs px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-700'}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Time grid */}
                  <div className="overflow-y-auto max-h-[600px]">
                    {HOURS.map(hour => {
                      const dayAppts = (appointmentsByDate.get(selectedDate) ?? [])
                        .filter(a => new Date(a.scheduled_datetime).getUTCHours() === hour)
                        .sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime))

                      return (
                        <div key={hour} className="flex border-b border-slate-800/60 min-h-[56px]">
                          {/* Hour label */}
                          <div className="w-20 shrink-0 px-3 py-3 text-right">
                            <span className="text-slate-500 text-xs font-mono">
                              {String(hour).padStart(2, '0')}:00
                            </span>
                            <span className="text-slate-700 text-xs block">UTC</span>
                          </div>
                          {/* Events */}
                          <div className="flex-1 px-3 py-2 flex flex-wrap gap-2">
                            {dayAppts.length === 0 ? (
                              <div className="h-full w-full border-l border-slate-800/40" />
                            ) : (
                              dayAppts.map(appt => {
                                const dt = new Date(appt.scheduled_datetime)
                                // Display in UTC since optimizer generates UTC slots
                                const timeStr = dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
                                const colorClass = SPECIALTY_COLORS[appt.specialty] ?? DEFAULT_COLOR
                                const isCompleted = !!appt.completed_at
                                return (
                                  <div
                                    key={appt.id}
                                    className={`flex flex-col px-3 py-2 rounded-lg border text-xs min-w-[180px] max-w-[260px] ${colorClass} ${isCompleted ? 'opacity-50' : ''}`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-mono font-medium">{timeStr}</span>
                                      {appt.room && (
                                        <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs">
                                          Sala {appt.room}
                                        </span>
                                      )}
                                      {isCompleted && (
                                        <span className="bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded text-xs">✓</span>
                                      )}
                                    </div>
                                    <span className="font-semibold truncate">{appt.patient_name}</span>
                                    <span className="opacity-80 truncate">{appt.specialty}</span>
                                    <span className="opacity-60 truncate text-xs mt-0.5">Dr. {appt.doctor_name}</span>
                                    <div className="mt-1 flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          appt.urgency_level >= 8 ? 'bg-red-400' :
                                          appt.urgency_level >= 5 ? 'bg-yellow-400' : 'bg-green-400'
                                        }`} />
                                        <span className="opacity-60">Urgencia {appt.urgency_level}</span>
                                      </div>
                                      {!isCompleted && (
                                        <button
                                          onClick={() => handleMarkComplete(appt.id, appt.appointment_id)}
                                          className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 transition font-medium"
                                        >
                                          ✓ Completar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Walk-in Modal */}
        {showWalkIn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold text-lg">Insertar Walk-in</h3>
                <button onClick={() => setShowWalkIn(false)} className="text-slate-400 hover:text-white transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleWalkInSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email del paciente</label>
                  <input
                    type="email"
                    required
                    value={wiPatientEmail}
                    onChange={(e) => setWiPatientEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    placeholder="paciente@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad</label>
                  <select
                    value={wiSpecialty}
                    onChange={(e) => setWiSpecialty(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                  >
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Urgencia: <span className="text-sky-400 font-bold">{wiUrgency}/10</span>
                  </label>
                  <input
                    type="range" min={1} max={10}
                    value={wiUrgency}
                    onChange={(e) => setWiUrgency(Number(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Síntomas (opcional)</label>
                  <textarea
                    value={wiSymptoms}
                    onChange={(e) => setWiSymptoms(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition resize-none"
                  />
                </div>

                {wiError && <p className="text-red-400 text-sm">{wiError}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={wiSubmitting}
                    className="flex-1 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white font-semibold rounded-lg transition"
                  >
                    {wiSubmitting ? 'Insertando...' : 'Insertar en Cola'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWalkIn(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
