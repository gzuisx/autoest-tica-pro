import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/Toaster'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import VehiclesPage from './pages/VehiclesPage'
import ServicesPage from './pages/ServicesPage'
import SchedulesPage from './pages/SchedulesPage'
import QuotesPage from './pages/QuotesPage'
import ServiceOrdersPage from './pages/ServiceOrdersPage'
import SettingsPage from './pages/SettingsPage'
import ReportsPage from './pages/ReportsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Rotas restritas por cargo — redireciona para /schedules se não tiver permissão
function RoleRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles: string[]
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/schedules" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Técnico não acessa dashboard — redireciona para agenda */}
        <Route
          path="dashboard"
          element={
            <RoleRoute roles={['admin', 'attendant', 'financial']}>
              <DashboardPage />
            </RoleRoute>
          }
        />

        <Route path="schedules" element={<SchedulesPage />} />

        <Route
          path="clients"
          element={
            <RoleRoute roles={['admin', 'attendant', 'financial']}>
              <ClientsPage />
            </RoleRoute>
          }
        />

        <Route
          path="vehicles"
          element={
            <RoleRoute roles={['admin', 'attendant', 'financial']}>
              <VehiclesPage />
            </RoleRoute>
          }
        />

        <Route
          path="services"
          element={
            <RoleRoute roles={['admin', 'attendant', 'financial']}>
              <ServicesPage />
            </RoleRoute>
          }
        />

        <Route
          path="quotes"
          element={
            <RoleRoute roles={['admin', 'attendant', 'financial']}>
              <QuotesPage />
            </RoleRoute>
          }
        />

        <Route path="service-orders" element={<ServiceOrdersPage />} />

        <Route
          path="reports"
          element={
            <RoleRoute roles={['admin', 'financial']}>
              <ReportsPage />
            </RoleRoute>
          }
        />

        <Route
          path="settings"
          element={
            <RoleRoute roles={['admin']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  )
}
