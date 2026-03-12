'use client'

import React, { useState } from 'react'
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

export function DashboardLayout({ children, role, userName, navItems }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/95 border-r border-slate-800/80 flex flex-col fixed h-full z-10">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shrink-0 shadow shadow-sky-600/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none tracking-tight">Qura Health</p>
              <p className="text-slate-500 text-xs mt-0.5">v1.0</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR[role]} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-white text-sm font-medium truncate leading-none mb-1.5">{userName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium ${
                  isActive
                    ? 'bg-sky-600/15 text-sky-300 border border-sky-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="w-4 h-4 shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-4 border-t border-slate-800/80 pt-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/8 transition text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen bg-slate-950">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
