'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { AdminPendingAppointment } from '@/lib/types'

// FullCalendar requires client-only rendering
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false })
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'

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

const SPECIALTY_EVENT_COLORS: Record<string, string> = {
  'Cardiología':       '#ef4444',
  'Neurología':        '#8b5cf6',
  'Traumatología':     '#f97316',
  'Neumología':        '#06b6d4',
  'Gastroenterología': '#eab308',
  'Dermatología':      '#ec4899',
  'Endocrinología':    '#84cc16',
  'Pediatría':         '#22c55e',
  'Ginecología':       '#d946ef',
  'Oftalmología':      '#14b8a6',
  'Psiquiatría':       '#6366f1',
  'Medicina Interna':  '#64748b',
  'Cirugía General':   '#dc2626',
  'General':           '#0ea5e9',
}
const DEFAULT_EVENT_COLOR = '#0ea5e9'

const SPECIALTIES = [
  'Cardiología', 'Neurología', 'Pediatría', 'Traumatología',
  'Ginecología', 'Medicina Interna', 'Cirugía General',
  'Oftalmología', 'Dermatología', 'Psiquiatría', 'General',
]

export function AdminDashboardClient({
  userName, adminId, initialPendingAppointments, initialOptimizerRuns,
  initialScheduledAppointments, metrics
}: Props) {
  const [pendingAppointments, setPendingAppointments] = useState(initialPendingAppointments)
  const [optimizerRuns, setOptimizerRuns] = useState(initialOptimizerRuns)
  const [scheduledAppointments, setScheduledAppointments] = useState(initialScheduledAppointments)
  const [filterUrgency, setFilterUrgency] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedAppt, setSelectedAppt] = useState<ScheduledAppointment | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'pending' | 'history'>('calendar')

  const [wiSpecialty, setWiSpecialty] = useState('General')
  const [wiUrgency, setWiUrgency] = useState(7)
  const [wiSymptoms, setWiSymptoms] = useState('')
  const [wiPatientEmail, setWiPatientEmail] = useState('')
  const [wiSubmitting, setWiSubmitting] = useState(false)
  const [wiError, setWiError] = useState<string | null>(null)

  const supabase = createClient()

  // Build FullCalendar events from scheduled appointments
  const calendarEvents = useMemo(() => scheduledAppointments.map(appt => ({
    id: appt.id,
    title: `${appt.patient_name} — ${appt.specialty}`,
    start: appt.scheduled_datetime,
    color: appt.completed_at
      ? '#94a3b8'
      : (SPECIALTY_EVENT_COLORS[appt.specialty] ?? DEFAULT_EVENT_COLOR),
    extendedProps: appt,
    classNames: appt.completed_at ? ['opacity-60'] : [],
  })), [scheduledAppointments])

  // Appointments for the selected day
  const dayAppointments = useMemo(() => {
    if (!selectedDate) return []
    return scheduledAppointments
      .filter(a => a.scheduled_datetime.slice(0, 10) === selectedDate)
      .sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime))
  }, [selectedDate, scheduledAppointments])

  const handleDateClick = useCallback((info: { dateStr: string }) => {
    setSelectedDate(info.dateStr)
    setSelectedAppt(null)
  }, [])

  const handleEventClick = useCallback((info: { event: { extendedProps: ScheduledAppointment } }) => {
    const appt = info.event.extendedProps
    setSelectedDate(appt.scheduled_datetime.slice(0, 10))
    setSelectedAppt(appt)
  }, [])

  async function handleMarkComplete(scheduleId: string, appointmentId: string) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('schedules').update({ completed_at: now }).eq('id', scheduleId)
    if (!error) {
      await supabase.from('appointments_pool').update({ status: 'completed' }).eq('id', appointmentId)
      setScheduledAppointments(prev => prev.map(s => s.id === scheduleId ? { ...s, completed_at: now } : s))
      if (selectedAppt?.id === scheduleId) setSelectedAppt({ ...selectedAppt, completed_at: now })
    }
  }

  async function handleRunOptimizer() {
    setRunning(true)
    setRunResult(null)
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: { lambda1: 10, lambda2: 10, num_reads: 1000, num_sweeps: 500 } }),
      })
      const result = await response.json()
      if (!response.ok) {
        setRunResult(`Error: ${result.error ?? 'Fallo en la optimización'}`)
      } else {
        const s = result.summary
        setRunResult(`✓ ${s?.assigned ?? 0} citas asignadas, ${s?.unassigned ?? 0} sin asignar`)
        window.location.reload()
      }
    } catch {
      setRunResult('Error de red: no se pudo conectar con el microservicio.')
    }
    setRunning(false)
  }

  async function handleWalkInSubmit(e: React.FormEvent) {
    e.preventDefault()
    setWiSubmitting(true)
    setWiError(null)
    const { data: patientUser } = await supabase.from('users').select('id').eq('email', wiPatientEmail).eq('role', 'patient').single()
    if (!patientUser) { setWiError('No se encontró un paciente con ese correo.'); setWiSubmitting(false); return }
    const { error } = await supabase.from('appointments_pool').insert({
      patient_id: (patientUser as { id: string }).id,
      requested_specialty: wiSpecialty,
      urgency_level: wiUrgency,
      symptoms: wiSymptoms || null,
      walk_in: true,
      inserted_by_admin: adminId,
    })
    if (error) { setWiError(error.message); setWiSubmitting(false); return }
    const { data: newPending } = await supabase.from('admin_pending_appointments').select('*').order('urgency_level', { ascending: false })
    if (newPending) setPendingAppointments(newPending as AdminPendingAppointment[])
    setShowWalkIn(false)
    setWiPatientEmail(''); setWiSpecialty('General'); setWiUrgency(7); setWiSymptoms('')
    setWiSubmitting(false)
  }

  const filteredPending = pendingAppointments.filter(a =>
    filterUrgency === null || a.urgency_level >= filterUrgency
  )

  return (
    <DashboardLayout role="admin" userName={userName} navItems={navItems} lightTheme>
      <div className="min-h-screen bg-sky-50">
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-sky-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-sky-900">Panel de Administración</h1>
              <p className="text-sky-500 text-sm mt-0.5">Gestión hospitalaria y optimización cuántica de agendas</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowWalkIn(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-sky-300 text-sky-700 font-medium text-sm hover:bg-sky-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Walk-in
              </button>
              <button
                onClick={handleRunOptimizer}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold text-sm transition"
              >
                {running ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Optimizando...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Ejecutar Optimización Cuántica</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Result banner */}
          {runResult && (
            <div className={`mb-4 px-4 py-2.5 border text-sm flex items-center justify-between ${
              runResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <span>{runResult}</span>
              <button onClick={() => setRunResult(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
            </div>
          )}

          {/* ── Metrics ──────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Pendientes de asignar', value: metrics.totalPending, color: 'text-amber-600', bg: 'border-amber-200' },
              { label: 'Citas programadas',     value: metrics.totalScheduled, color: 'text-sky-600', bg: 'border-sky-200' },
              { label: 'Completadas hoy',       value: metrics.completedToday, color: 'text-emerald-600', bg: 'border-emerald-200' },
            ].map(m => (
              <div key={m.label} className={`bg-white border ${m.bg} p-4`}>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{m.label}</p>
                <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* ── Tab navigation ───────────────────────────────── */}
          <div className="flex border-b border-sky-200 mb-0 bg-white">
            {[
              { key: 'calendar', label: 'Calendario de Citas' },
              { key: 'pending',  label: `Cola Pendiente (${filteredPending.length})` },
              { key: 'history',  label: 'Historial de Optimizaciones' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab.key
                    ? 'border-sky-600 text-sky-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-sky-600 hover:bg-sky-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Calendar tab ─────────────────────────────────── */}
          {activeTab === 'calendar' && (
            <div className="flex gap-4 mt-0">
              {/* Calendar */}
              <div className="flex-1 bg-white border border-sky-200 border-t-0">
                <div className="qura-calendar p-4">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    initialDate="2026-01-01"
                    locale={esLocale}
                    events={calendarEvents}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth',
                    }}
                    validRange={{ start: '2026-01-01', end: '2026-12-31' }}
                    height="auto"
                    dayMaxEvents={3}
                    eventDisplay="block"
                    eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }}
                  />
                </div>
              </div>

              {/* Day detail panel */}
              <div className="w-80 shrink-0">
                {selectedDate ? (
                  <div className="bg-white border border-sky-200 border-t-0 h-full">
                    <div className="bg-sky-600 text-white px-4 py-3">
                      <p className="font-semibold text-sm">
                        {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('es-PE', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
                        })}
                      </p>
                      <p className="text-sky-200 text-xs mt-0.5">{dayAppointments.length} cita{dayAppointments.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="overflow-y-auto max-h-[600px]">
                      {dayAppointments.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">Sin citas programadas</div>
                      ) : (
                        dayAppointments.map(appt => {
                          const isSelected = selectedAppt?.id === appt.id
                          const isCompleted = !!appt.completed_at
                          const color = SPECIALTY_EVENT_COLORS[appt.specialty] ?? DEFAULT_EVENT_COLOR
                          return (
                            <div
                              key={appt.id}
                              onClick={() => setSelectedAppt(isSelected ? null : appt)}
                              className={`border-b border-sky-100 cursor-pointer transition ${
                                isSelected ? 'bg-sky-50' : 'hover:bg-sky-50/50'
                              } ${isCompleted ? 'opacity-60' : ''}`}
                            >
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-mono text-sky-600 font-semibold">
                                      {new Date(appt.scheduled_datetime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
                                    </span>
                                    {isCompleted && <span className="text-xs text-emerald-500">✓</span>}
                                  </div>
                                  <p className="text-sm font-medium text-slate-800 truncate">{appt.patient_name}</p>
                                  <p className="text-xs text-slate-500 truncate">{appt.specialty} · Dr. {appt.doctor_name}</p>
                                  {appt.room && <p className="text-xs text-slate-400">Sala {appt.room}</p>}
                                </div>
                                <div className={`text-xs font-bold px-1.5 py-0.5 shrink-0 ${
                                  appt.urgency_level >= 8 ? 'bg-red-100 text-red-600' :
                                  appt.urgency_level >= 5 ? 'bg-amber-100 text-amber-600' :
                                  'bg-green-100 text-green-600'
                                }`}>
                                  U{appt.urgency_level}
                                </div>
                              </div>
                              {isSelected && !isCompleted && (
                                <div className="px-4 pb-3">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleMarkComplete(appt.id, appt.appointment_id) }}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                                  >
                                    ✓ Marcar como completada
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-sky-200 border-t-0 p-6 text-center">
                    <svg className="w-10 h-10 text-sky-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-slate-400 text-sm">Selecciona un día en el calendario</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Pending tab ──────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="bg-white border border-sky-200 border-t-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-sky-100">
                <p className="text-sm font-medium text-slate-700">Cola de Citas Pendientes</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Urgencia mín.:</span>
                  <select
                    value={filterUrgency ?? ''}
                    onChange={e => setFilterUrgency(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border border-sky-200 text-slate-600 px-2 py-1 bg-white"
                  >
                    <option value="">Todas</option>
                    {[3,5,7,9].map(v => <option key={v} value={v}>{v}+</option>)}
                  </select>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-sky-50">
                  <tr>
                    {['Paciente', 'Especialidad', 'Urgencia', 'Origen', 'Registrado'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-sky-700 uppercase tracking-wide border-b border-sky-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hay citas pendientes</td></tr>
                  ) : filteredPending.map(a => (
                    <tr key={a.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{a.patient_name}</p>
                        <p className="text-xs text-slate-400">{a.patient_email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.requested_specialty}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-7 h-7 text-xs font-bold leading-7 text-center ${
                          a.urgency_level >= 8 ? 'bg-red-100 text-red-600' :
                          a.urgency_level >= 5 ? 'bg-amber-100 text-amber-600' :
                          'bg-green-100 text-green-600'
                        }`}>{a.urgency_level}</span>
                      </td>
                      <td className="px-4 py-3">
                        {a.referral_source === 'doctor_referred'
                          ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5">Interconsulta</span>
                          : <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5">Directo</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(a.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── History tab ──────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="bg-white border border-sky-200 border-t-0">
              <div className="px-4 py-3 border-b border-sky-100">
                <p className="text-sm font-medium text-slate-700">Historial de Optimizaciones Cuánticas</p>
              </div>
              {optimizerRuns.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Sin ejecuciones registradas</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-sky-50">
                    <tr>
                      {['Fecha', 'Estado', 'Asignadas', 'Sin asignar', 'Energía', 'Duración'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-sky-700 uppercase tracking-wide border-b border-sky-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {optimizerRuns.map(run => {
                      const summary = run.result_summary as { assigned?: number; unassigned?: number; energy?: number } | null
                      return (
                        <tr key={run.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {new Date(run.run_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 font-medium ${
                              run.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              run.status === 'failed'    ? 'bg-red-100 text-red-600' :
                              'bg-amber-100 text-amber-600'
                            }`}>{run.status === 'completed' ? 'Completado' : run.status === 'failed' ? 'Error' : 'Ejecutando'}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{summary?.assigned ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{summary?.unassigned ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{typeof summary?.energy === 'number' ? summary.energy.toFixed(0) : '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Walk-in Modal */}
      {showWalkIn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-sky-200 w-full max-w-md shadow-xl">
            <div className="bg-sky-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold">Insertar Walk-in</h3>
              <button onClick={() => setShowWalkIn(false)} className="text-sky-200 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleWalkInSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo del paciente</label>
                <input type="email" value={wiPatientEmail} onChange={e => setWiPatientEmail(e.target.value)} required
                  className="w-full border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Especialidad</label>
                <select value={wiSpecialty} onChange={e => setWiSpecialty(e.target.value)}
                  className="w-full border border-sky-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400">
                  {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Urgencia: <span className={`font-bold ${wiUrgency >= 8 ? 'text-red-500' : wiUrgency >= 5 ? 'text-amber-500' : 'text-green-500'}`}>{wiUrgency}/10</span>
                </label>
                <input type="range" min={1} max={10} value={wiUrgency} onChange={e => setWiUrgency(Number(e.target.value))} className="w-full accent-sky-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Síntomas (opcional)</label>
                <textarea value={wiSymptoms} onChange={e => setWiSymptoms(e.target.value)} rows={2}
                  className="w-full border border-sky-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              {wiError && <p className="text-red-500 text-xs">{wiError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={wiSubmitting}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold text-sm transition">
                  {wiSubmitting ? 'Guardando...' : 'Insertar Walk-in'}
                </button>
                <button type="button" onClick={() => setShowWalkIn(false)}
                  className="px-4 py-2.5 border border-sky-200 text-slate-600 hover:bg-sky-50 text-sm transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
