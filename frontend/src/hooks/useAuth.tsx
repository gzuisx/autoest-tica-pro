import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'
import { identifyUser, resetAnalytics } from '../lib/analytics'

interface Tenant {
  id: string
  name: string
  slug: string
  logoUrl?: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface SessionData {
  accessToken: string
  refreshToken: string
  user: User
  tenant: Tenant
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, slug: string) => Promise<void>
  logout: () => void
  setSession: (data: SessionData) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const userStr = localStorage.getItem('user')
    const tenantStr = localStorage.getItem('tenant')
    if (token && userStr && tenantStr) {
      setState({
        user: JSON.parse(userStr),
        tenant: JSON.parse(tenantStr),
        isAuthenticated: true,
        isLoading: false,
      })
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  async function login(email: string, password: string, slug: string) {
    const { data } = await api.post('/auth/login', { email, password, slug })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('tenant', JSON.stringify(data.tenant))
    setState({ user: data.user, tenant: data.tenant, isAuthenticated: true, isLoading: false })
    identifyUser(data.user.id, { email: data.user.email, name: data.user.name, tenantId: data.tenant.id })
  }

  function setSession(data: SessionData) {
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('tenant', JSON.stringify(data.tenant))
    setState({ user: data.user, tenant: data.tenant, isAuthenticated: true, isLoading: false })
    identifyUser(data.user.id, { email: data.user.email, name: data.user.name, tenantId: data.tenant.id })
  }

  function logout() {
    resetAnalytics()
    localStorage.clear()
    setState({ user: null, tenant: null, isAuthenticated: false, isLoading: false })
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
