'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { AdminPendingAppointment } from '@/lib/types'

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

export function AdminDashboardClient({
  userName, adminId, initialPendingAppointments, initialOptimizerRuns, metrics
}: Props) {
  const [pendingAppointments, setPendingAppointments] = useState(initialPendingAppointments)
  const [optimizerRuns, setOptimizerRuns] = useState(initialOptimizerRuns)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending'>('all')
  const [filterUrgency, setFilterUrgency] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [showWalkIn, setShowWalkIn] = useState(false)

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
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm shadow-lg shadow-violet-900/30"
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
            { label: 'Pendientes de asignar', value: metrics.totalPending, color: 'text-yellow-400', icon: '⏳' },
            { label: 'Citas programadas', value: metrics.totalScheduled, color: 'text-blue-400', icon: '📅' },
            { label: 'Completadas hoy', value: metrics.completedToday, color: 'text-green-400', icon: '✅' },
          ].map((m) => (
            <div key={m.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-slate-400 text-sm">{m.label}</p>
              </div>
              <p className={`text-4xl font-bold ${m.color}`}>{m.value}</p>
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
                            <span className="text-slate-400 col-span-2">Energía QUBO: <span className="text-violet-400 font-mono">{Number(summary.energy).toFixed(3)}</span></span>
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
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                    placeholder="paciente@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad</label>
                  <select
                    value={wiSpecialty}
                    onChange={(e) => setWiSpecialty(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                  >
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Urgencia: <span className="text-violet-400 font-bold">{wiUrgency}/10</span>
                  </label>
                  <input
                    type="range" min={1} max={10}
                    value={wiUrgency}
                    onChange={(e) => setWiUrgency(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Síntomas (opcional)</label>
                  <textarea
                    value={wiSymptoms}
                    onChange={(e) => setWiSymptoms(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none"
                  />
                </div>

                {wiError && <p className="text-red-400 text-sm">{wiError}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={wiSubmitting}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold rounded-lg transition"
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
