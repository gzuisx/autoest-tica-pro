import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Car, Wrench, Calendar,
  FileText, ClipboardList, Settings, LogOut, Menu, X, BarChart2,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlanUsage } from '../hooks/usePlanUsage'
import { cn } from '../lib/utils'
import PlanWarningBanner from './PlanWarningBanner'

const ALL_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'attendant', 'financial'] },
  { to: '/schedules', icon: Calendar, label: 'Agenda', roles: ['admin', 'attendant', 'technician', 'financial'] },
  { to: '/clients', icon: Users, label: 'Clientes', roles: ['admin', 'attendant', 'financial'] },
  { to: '/vehicles', icon: Car, label: 'Veículos', roles: ['admin', 'attendant', 'financial'] },
  { to: '/services', icon: Wrench, label: 'Serviços', roles: ['admin', 'attendant', 'financial'] },
  { to: '/quotes', icon: FileText, label: 'Orçamentos', roles: ['admin', 'attendant', 'financial'] },
  { to: '/service-orders', icon: ClipboardList, label: 'Ordens de Serviço', roles: ['admin', 'attendant', 'technician', 'financial'] },
  { to: '/reports', icon: BarChart2, label: 'Relatórios', roles: ['admin', 'financial'] },
  { to: '/settings', icon: Settings, label: 'Configurações', roles: ['admin'] },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  attendant: 'Atendente',
  financial: 'Financeiro',
}

export default function Layout() {
  const { user, tenant, logout } = useAuth()
  const { data: planUsage } = usePlanUsage()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = ALL_NAV_ITEMS.filter((item) =>
    !user?.role || item.roles.includes(user.role)
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-700 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Car className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{tenant?.name}</p>
            <p className="text-xs text-slate-400">AutoEstética Pro</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="rounded p-1 text-slate-400 hover:text-white"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar mobile */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-foreground">{tenant?.name}</span>
        </header>

        {/* Plan warning banner */}
        {planUsage && <PlanWarningBanner usage={planUsage} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
