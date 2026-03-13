'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { DoctorScheduleEntry } from '@/lib/types'

interface Props {
  userName: string
  doctorId: string
  specialty: string
  room: string | null
  maxDailyPatients: number
  initialSchedule: DoctorScheduleEntry[]
  todayCount: number
  completedToday: number
}

type ViewMode = 'today' | 'week' | 'all'

const navItems = [
  {
    label: 'Mi Agenda',
    href: '/dashboard/doctor',
    icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

function getDateGroup(iso: string): string {
  // Usar fecha UTC para consistencia con el optimizer
  const dateUTC = iso.slice(0, 10) // "YYYY-MM-DD"
  const todayUTC = new Date().toISOString().slice(0, 10)
  const tomorrowUTC = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  if (dateUTC === todayUTC) return 'Hoy'
  if (dateUTC === tomorrowUTC) return 'Mañana'
  return new Date(iso).toLocaleDateString('es-PE', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC',
  })
}

export function DoctorDashboardClient({
  userName, doctorId, specialty, room, maxDailyPatients, initialSchedule, todayCount, completedToday
}: Props) {
  const [schedule] = useState<DoctorScheduleEntry[]>(initialSchedule)
  const [viewMode, setViewMode] = useState<ViewMode>('today')

  const today = new Date().toISOString().slice(0, 10)
  const weekEndISO = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const filteredSchedule = schedule.filter(s => {
    const dt = s.scheduled_datetime
    if (viewMode === 'today') return dt.slice(0, 10) === today
    if (viewMode === 'week') return dt >= today && dt <= weekEndISO
    return dt >= today
  })

  // Group by date
  const grouped: Record<string, DoctorScheduleEntry[]> = {}
  for (const entry of filteredSchedule) {
    const group = getDateGroup(entry.scheduled_datetime)
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(entry)
  }

  const pendingToday = todayCount - completedToday
  const completionRate = todayCount > 0 ? Math.round((completedToday / todayCount) * 100) : 0

  return (
    <DashboardLayout role="doctor" userName={userName} navItems={navItems}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Agenda Médica</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sky-400 font-medium text-sm">{specialty}</span>
              {room && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-sm">Sala {room}</span>
                </>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-sm">Máx. {maxDailyPatients} pacientes/día</span>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['today', 'week', 'all'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === mode
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'today' ? 'Hoy' : mode === 'week' ? 'Esta semana' : 'Próximas'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Pacientes hoy</p>
            <p className="text-3xl font-bold text-white mt-1">{todayCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Pendientes</p>
            <p className="text-3xl font-bold text-yellow-400 mt-1">{pendingToday}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Cumplimiento</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-3xl font-bold text-emerald-400">{completionRate}%</p>
            </div>
            <div className="mt-2 bg-slate-800 rounded-full h-1.5">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Schedule list */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400">No tienes citas programadas para este período.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([dateGroup, entries]) => (
              <div key={dateGroup}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-white font-semibold capitalize">{dateGroup}</h2>
                  <span className="text-slate-500 text-sm">({entries.length} cita{entries.length !== 1 ? 's' : ''})</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                <div className="space-y-3">
                  {entries.map((entry) => {
                    const isCompleted = entry.completed_at !== null
                    return (
                      <div
                        key={entry.schedule_id}
                        className={`bg-slate-900 border rounded-xl p-5 transition ${
                          isCompleted
                            ? 'border-slate-800 opacity-60'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Time column */}
                          <div className="shrink-0 text-center w-16">
                            <p className="text-sky-400 font-bold text-lg leading-none">
                              {new Date(entry.scheduled_datetime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                            </p>
                            <p className="text-slate-600 text-xs">UTC</p>
                            {entry.room && (
                              <p className="text-slate-500 text-xs mt-1">Sala {entry.room}</p>
                            )}
                          </div>

                          <div className="w-px h-14 bg-slate-800 shrink-0" />

                          {/* Patient info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-semibold">{entry.patient_name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                entry.urgency_level >= 8 ? 'bg-red-500/15 text-red-400' :
                                entry.urgency_level >= 5 ? 'bg-yellow-500/15 text-yellow-400' :
                                'bg-green-500/15 text-emerald-400'
                              }`}>
                                U{entry.urgency_level}
                              </span>
                              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                {entry.requested_specialty}
                              </span>
                            </div>
                            {entry.symptoms && (
                              <p className="text-slate-400 text-sm line-clamp-2">{entry.symptoms}</p>
                            )}
                            {isCompleted && (
                              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Completado a las {new Date(entry.completed_at!).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>

                          {/* Estado — solo lectura, el admin verifica el cumplimiento */}
                          {isCompleted ? (
                            <span className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              Atendido
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                              Pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </DashboardLayout>
  )
}
