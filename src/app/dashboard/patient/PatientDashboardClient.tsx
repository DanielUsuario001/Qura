'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'

const SPECIALTIES = [
  'Cardiología', 'Neurología', 'Pediatría', 'Traumatología',
  'Ginecología', 'Medicina Interna', 'Cirugía General',
  'Oftalmología', 'Dermatología', 'Psiquiatría', 'General',
]

interface AppointmentWithSchedule {
  id: string
  urgency_level: number
  requested_specialty: string
  symptoms: string | null
  status: string
  created_at: string
  walk_in: boolean
  schedules: {
    scheduled_datetime: string
    room: string | null
    users: { full_name: string } | null
  }[] | null
}

interface Props {
  userName: string
  userId: string
  initialAppointments: AppointmentWithSchedule[]
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente',   color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  scheduled: { label: 'Programado',  color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  completed: { label: 'Completado',  color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelado',   color: 'bg-red-500/10 text-red-400 border-red-500/30' },
}

const navItems = [
  {
    label: 'Mis Citas',
    href: '/dashboard/patient',
    icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
]

export function PatientDashboardClient({ userName, userId, initialAppointments }: Props) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [showForm, setShowForm] = useState(false)
  const [specialty, setSpecialty] = useState('General')
  const [urgency, setUrgency] = useState(5)
  const [symptoms, setSymptoms] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('appointments_pool')
      .insert({
        patient_id: userId,
        requested_specialty: specialty,
        urgency_level: urgency,
        symptoms: symptoms || null,
      })
      .select()
      .single()

    if (error) {
      setFormError(error.message)
      setSubmitting(false)
      return
    }

    setAppointments([{ ...(data as AppointmentWithSchedule), schedules: null }, ...appointments])
    setFormSuccess(true)
    setSubmitting(false)
    setTimeout(() => {
      setFormSuccess(false)
      setShowForm(false)
      setSymptoms('')
      setUrgency(5)
      setSpecialty('General')
    }, 2000)
  }

  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length

  return (
    <DashboardLayout role="patient" userName={userName} navItems={navItems}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Bienvenido, {userName.split(' ')[0]}</h1>
            <p className="text-slate-400 mt-1">Gestiona tus solicitudes de cita médica</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Solicitud
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">En espera</p>
            <p className="text-3xl font-bold text-yellow-400 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Programadas</p>
            <p className="text-3xl font-bold text-sky-400 mt-1">{scheduledCount}</p>
          </div>
        </div>

        {/* New appointment form */}
        {showForm && (
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 mb-6 shadow-lg shadow-blue-900/10">
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Nueva Solicitud de Cita
            </h3>

            {formSuccess ? (
              <div className="flex items-center gap-3 py-4 text-green-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>¡Solicitud enviada correctamente!</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad requerida</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                  >
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-slate-500 text-xs mt-1.5">La fecha y hora será asignada automáticamente por el sistema de optimización cuántica.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nivel de urgencia: <span className={`font-bold ${urgency >= 8 ? 'text-red-400' : urgency >= 5 ? 'text-yellow-400' : 'text-green-400'}`}>{urgency}/10</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">Baja (1)</span>
                    <input
                      type="range"
                      min={1} max={10}
                      value={urgency}
                      onChange={(e) => setUrgency(Number(e.target.value))}
                      className="flex-1 accent-sky-500"
                    />
                    <span className="text-slate-500 text-xs">Alta (10)</span>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>Chequeo rutinario</span>
                    <span>Emergencia</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Síntomas / Descripción</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition resize-none"
                    placeholder="Describe tus síntomas con el mayor detalle posible..."
                  />
                </div>

                {formError && (
                  <p className="text-red-400 text-sm">{formError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold rounded-lg transition"
                  >
                    {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Appointments list */}
        <div>
          <h2 className="text-white font-semibold mb-4 text-lg">Historial de Solicitudes</h2>
          {appointments.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
              <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-400">No tienes solicitudes de cita aún.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
              >
                Crear tu primera solicitud →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const statusCfg = STATUS_CONFIG[appt.status as keyof typeof STATUS_CONFIG]
                const schedule = appt.schedules?.[0]
                return (
                  <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`text-xs font-bold ${appt.urgency_level >= 8 ? 'text-red-400' : appt.urgency_level >= 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                            Urgencia {appt.urgency_level}/10
                          </span>
                          {appt.walk_in && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-full">Walk-in</span>
                          )}
                        </div>
                        <p className="text-white font-medium">{appt.requested_specialty}</p>
                        {appt.symptoms && (
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">{appt.symptoms}</p>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs shrink-0">
                        {new Date(appt.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Schedule details */}
                    {schedule && (
                      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-slate-500 text-xs mb-0.5">Fecha y hora</p>
                          <p className="text-sky-300 text-sm font-medium">
                            {new Date(schedule.scheduled_datetime).toLocaleString('es-PE', {
                              weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              timeZone: 'UTC'
                            })}
                            <span className="text-slate-500 text-xs ml-1">UTC</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs mb-0.5">Doctor asignado</p>
                          <p className="text-white text-sm font-medium">{schedule.users?.full_name ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs mb-0.5">Sala</p>
                          <p className="text-white text-sm font-medium">{schedule.room ?? '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
