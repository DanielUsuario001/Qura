'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface DashboardLayoutProps {
  children: React.ReactNode
  role: UserRole
  userName: string
  navItems: NavItem[]
  lightTheme?: boolean
}

const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Paciente',
  doctor:  'Médico',
  admin:   'Administrador',
}

const ROLE_BADGE: Record<UserRole, string> = {
  patient: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
  doctor:  'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25',
  admin:   'bg-sky-600/15 text-sky-200 border border-sky-600/25',
}

const ROLE_AVATAR: Record<UserRole, string> = {
  patient: 'bg-sky-600',
  doctor:  'bg-cyan-600',
  admin:   'bg-sky-700',
}

export function DashboardLayout({ children, role, userName, navItems, lightTheme = false }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const lt = lightTheme

  return (
    <div className={`min-h-screen flex ${lt ? 'bg-sky-50' : 'bg-slate-950'}`}>
      {/* Sidebar */}
      <aside className={`w-56 flex flex-col fixed h-full z-10 ${
        lt
          ? 'bg-white border-r border-sky-200'
          : 'bg-slate-900/95 border-r border-slate-800/80'
      }`}>
        {/* Brand */}
        <div className={`px-5 py-4 border-b ${lt ? 'border-sky-100' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Qura" width={28} height={28} className="shrink-0" />
            <div>
              <p className={`font-bold text-sm leading-none tracking-tight ${lt ? 'text-sky-900' : 'text-white'}`}>Qura</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className={`px-4 py-3 border-b ${lt ? 'border-sky-100' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 ${lt ? '' : 'rounded-full'} ${ROLE_AVATAR[role]} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className={`text-sm font-medium truncate leading-none mb-1 ${lt ? 'text-slate-800' : 'text-white'}`}>{userName}</p>
              <span className={`text-xs px-2 py-0.5 font-medium ${
                lt
                  ? 'bg-sky-100 text-sky-700'
                  : `rounded-full ${ROLE_BADGE[role]}`
              }`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 transition text-sm font-medium ${
                  lt
                    ? isActive
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
                    : isActive
                      ? 'bg-sky-600/15 text-sky-300 border border-sky-600/25 rounded-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg'
                }`}
              >
                <span className="w-4 h-4 shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className={`px-3 pb-4 pt-4 border-t ${lt ? 'border-sky-100' : 'border-slate-800/80'}`}>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={`flex items-center gap-3 w-full px-3 py-2.5 transition text-sm font-medium ${
              lt
                ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                : 'rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/8'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ml-56 min-h-screen ${lt ? 'bg-sky-50' : 'bg-slate-950'}`}>
        {lt ? children : <div className="p-8">{children}</div>}
      </main>
    </div>
  )
}
