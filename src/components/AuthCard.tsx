import React from 'react'
import Image from 'next/image'

interface AuthCardProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950 flex items-center justify-center p-4">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(14,165,233,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <Image src="/logo.png" alt="Qura Health" width={72} height={72} className="rounded-2xl shadow-lg shadow-sky-600/20" priority />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Qura Health</h1>
          <p className="text-sky-400 text-sm mt-1 font-medium tracking-wide uppercase">Quantum-Powered Clinical Scheduling</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-sky-900/50 rounded-2xl p-8 shadow-2xl shadow-sky-950/50">
          <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
          {subtitle && (
            <p className="text-slate-400 text-sm mb-6">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
