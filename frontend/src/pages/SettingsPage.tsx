import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Save, Building2, Users, Plus, X, Eye, EyeOff } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'

interface TenantForm {
  name: string
  phone?: string
  email?: string
  address?: string
}

interface UserForm {
  name: string
  email: string
  password: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  attendant: 'Atendente',
  financial: 'Financeiro',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  technician: 'bg-green-100 text-green-700',
  attendant: 'bg-blue-100 text-blue-700',
  financial: 'bg-orange-100 text-orange-700',
}

const fc = (hasError?: boolean) =>
  cn(
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
  )

function AddUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserForm>({ defaultValues: { role: 'attendant' } })

  const mutation = useMutation({
    mutationFn: (data: UserForm) => api.post('/tenant/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-users'] })
      onClose()
    },
  })

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adicionar usuário</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-600">Preencha todos os campos obrigatórios</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <input
              {...register('name', { required: 'Obrigatório' })}
              placeholder="Nome do usuário"
              className={fc(errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">E-mail *</label>
            <input
              {...register('email', {
                required: 'Obrigatório',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
              })}
              type="email"
              placeholder="email@exemplo.com"
              className={fc(errors.email)}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Senha *</label>
            <div className="relative">
              <input
                {...register('password', {
                  required: 'Obrigatório',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                className={fc(errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Cargo *</label>
            <select {...register('role')} className={fc()}>
              <option value="technician">Técnico — acesso a Agenda e Ordens de Serviço</option>
              <option value="admin">Administrador — acesso total</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Técnico só vê Agenda e Ordens de Serviço. Administrador acessa tudo.
            </p>
          </div>

          {mutation.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">
                {(mutation.error as any)?.response?.data?.error || 'Erro ao criar usuário.'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [showAddUser, setShowAddUser] = useState(false)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get('/tenant').then((r) => r.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['tenant-users'],
    queryFn: () => api.get('/tenant/users').then((r) => r.data),
    enabled: isAdmin,
  })

  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<TenantForm>({
    values: tenant,
  })

  const mutation = useMutation({
    mutationFn: (data: TenantForm) => api.put('/tenant', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Informações da sua estética</p>
      </div>

      {/* Dados da estética */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold text-foreground">Dados da estética</h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome da estética</label>
            <input
              {...register('name')}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Telefone / WhatsApp</label>
              <input
                {...register('phone')}
                placeholder="(11) 99999-9999"
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                {...register('email')}
                type="email"
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Endereço</label>
            <input
              {...register('address')}
              placeholder="Rua, número, bairro, cidade"
              className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>
              Identificador:{' '}
              <span className="font-mono font-medium text-foreground">{tenant?.slug}</span>
            </p>
            <p>
              Plano: <span className="font-medium capitalize text-foreground">{tenant?.plan}</span>
            </p>
          </div>

          {mutation.isSuccess && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              Configurações salvas com sucesso!
            </div>
          )}

          {mutation.error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(mutation.error as any)?.response?.data?.error || 'Erro ao salvar.'}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !isDirty}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {mutation.isPending ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </form>
      </div>

      {/* Equipe */}
      {isAdmin && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Equipe</h2>
                <p className="text-xs text-muted-foreground">{users.length} usuário(s)</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {users.map((u: any) => (
              <div
                key={u.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3',
                  !u.active && 'opacity-50',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600',
                  )}
                >
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} />}
    </div>
  )
}
