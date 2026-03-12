'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AuthCard } from '@/components/AuthCard'
import type { UserRole } from '@/lib/types'

const SPECIALTIES = [
  'Cardiología', 'Neurología', 'Pediatría', 'Traumatología',
  'Ginecología', 'Medicina Interna', 'Cirugía General',
  'Oftalmología', 'Dermatología', 'Psiquiatría', 'General',
]

const ROLE_OPTIONS: {
  value: UserRole
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: 'patient',
    label: 'Paciente',
    description: 'Solicitar citas médicas',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    value: 'doctor',
    label: 'Doctor',
    description: 'Ver y gestionar mi agenda',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Gestión hospitalaria completa',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<UserRole>('patient')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [specialty, setSpecialty] = useState('General')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          ...(role === 'doctor' ? { specialty } : {}),
        },
      },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/auth/login'), 3000)
  }

  if (success) {
    return (
      <AuthCard title="Cuenta creada" subtitle="Revisa tu correo para confirmar tu cuenta">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-sky-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-500/30">
            <svg className="w-7 h-7 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm">
            Enlace de confirmación enviado a{' '}
            <span className="text-sky-400 font-medium">{email}</span>
          </p>
          <p className="text-slate-500 text-xs mt-3">Redirigiendo al login en 3 segundos...</p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Crear Cuenta" subtitle="Únete al sistema de salud quantum-optimizado">
      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Selecciona tu rol
          </p>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                role === opt.value
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                role === opt.value ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700 text-slate-400'
              }`}>
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{opt.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{opt.description}</p>
              </div>
              {role === opt.value && (
                <svg className="w-5 h-5 text-sky-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition mt-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Continuar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-sky-400 text-sm transition mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a selección de rol
          </button>

          <div className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
            <div className="text-sky-400">
              {ROLE_OPTIONS.find(r => r.value === role)?.icon}
            </div>
            <span className="text-sky-300 text-sm font-medium">
              {ROLE_OPTIONS.find(r => r.value === role)?.label}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Dr. Juan Pérez García"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="usuario@hospital.pe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {role === 'doctor' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              >
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando cuenta...
              </span>
            ) : 'Crear Cuenta'}
          </button>
        </form>
      )}

      <p className="text-center text-slate-400 text-sm mt-6">
        Tienes cuenta?{' '}
        <Link href="/auth/login" className="text-sky-400 hover:text-sky-300 font-medium transition">
          Inicia sesión
        </Link>
      </p>
    </AuthCard>
  )
}
