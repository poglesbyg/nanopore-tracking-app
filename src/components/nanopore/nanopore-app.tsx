import { Toaster } from '../ui/sonner'
import AuthWrapper from '../auth/auth-wrapper'
import NanoporeDashboard from './nanopore-dashboard'

export function NanoporeApp() {
  return (
    <AuthWrapper>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <NanoporeDashboard />
        <Toaster />
      </div>
    </AuthWrapper>
  )
}
