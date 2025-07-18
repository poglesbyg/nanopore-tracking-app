import type { ReactNode } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  // For now, just render the children without authentication
  // In a real implementation, this would handle authentication with the auth microservice
  return <>{children}</>
}

// Simple hook for auth context
export function useAuth() {
  return {
    user: null,
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
    isLoading: false
  }
} 