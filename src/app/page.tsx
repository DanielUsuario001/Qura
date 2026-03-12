// Root page — middleware.ts handles redirecting authenticated users
// to their role-specific dashboard. Unauthenticated users land here
// and are redirected to /auth/login by the middleware.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/auth/login')
}
