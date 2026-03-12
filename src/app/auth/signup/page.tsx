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

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: string }[] = [
  {
    value: 'patient',
    label: 'Paciente',
    description: 'Solicitar citas médicas',
    icon: '🧑‍⚕️',
  },
  {
    value: 'doctor',
    label: 'Doctor',
    description: 'Ver y gestionar mi agenda',
    icon: '👨‍💼',
  },
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Gestión hospitalaria completa',
    icon: '🏥',
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
      <AuthCard title="¡Cuenta creada!" subtitle="Revisa tu correo para confirmar tu cuenta">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm">
            Te hemos enviado un enlace de confirmación a <span className="text-blue-400 font-medium">{email}</span>
          </p>
          <p className="text-slate-500 text-xs mt-3">Redirigiendo al login en 3 segundos...</p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Crear Cuenta"
      subtitle="Únete al sistema de salud quantum-optimizado"
    >
      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Selecciona tu rol</p>
          <div className="space-y-3">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                  role === opt.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <p className="text-white font-semibold">{opt.label}</p>
                  <p className="text-slate-400 text-sm">{opt.description}</p>
                </div>
                {role === opt.value && (
                  <svg className="w-5 h-5 text-blue-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition mt-2"
          >
            Continuar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a selección de rol
          </button>

          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-2">
            <span className="text-lg">{ROLE_OPTIONS.find(r => r.value === role)?.icon}</span>
            <span className="text-blue-300 text-sm font-medium">
              Registrando como: {ROLE_OPTIONS.find(r => r.value === role)?.label}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {role === 'doctor' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando cuenta...
              </span>
            ) : (
              'Crear Cuenta'
            )}
          </button>
        </form>
      )}

      <p className="text-center text-slate-400 text-sm mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
          Inicia sesión
        </Link>
      </p>
    </AuthCard>
  )
}
