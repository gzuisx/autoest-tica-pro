import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Check } from 'lucide-react'
import api from '../services/api'
import { cn } from '../lib/utils'

interface Client {
  id: string
  name: string
  phone: string
  whatsapp?: string
  registrationNumber?: number
}

interface ClientComboboxProps {
  value: string
  onChange: (clientId: string, client?: Client) => void
  hasError?: boolean
  placeholder?: string
}

function formatRegNum(n?: number) {
  return n ? `#${String(n).padStart(3, '0')}` : ''
}

export function ClientCombobox({ value, onChange, hasError, placeholder = 'Buscar cliente...' }: ClientComboboxProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['clients-search', search],
    queryFn: () =>
      api.get('/clients', { params: { search, limit: 20 } }).then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!value) {
      setSelectedClient(null)
      setSearch('')
    }
  }, [value])

  const handleSelect = (client: Client) => {
    setSelectedClient(client)
    setSearch('')
    setOpen(false)
    onChange(client.id, client)
  }

  const handleClear = () => {
    setSelectedClient(null)
    setSearch('')
    onChange('', undefined)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const clients: Client[] = data?.clients ?? []

  if (selectedClient) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors bg-primary/5',
          hasError ? 'border-red-500' : 'border-primary/40',
        )}
      >
        <Check className="h-4 w-4 shrink-0 text-primary" />
        {selectedClient.registrationNumber && (
          <span className="shrink-0 text-xs font-mono font-bold text-primary">
            {formatRegNum(selectedClient.registrationNumber)}
          </span>
        )}
        <span className="flex-1 font-medium text-foreground truncate">{selectedClient.name}</span>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors',
            hasError
              ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
              : 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20',
          )}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-white shadow-lg">
          {clients.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum cliente encontrado' : 'Digite para buscar...'}
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {clients.map((client) => (
                <li
                  key={client.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(client)
                  }}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  </div>
                  {client.registrationNumber && (
                    <span className="shrink-0 text-xs font-mono text-muted-foreground">
                      {formatRegNum(client.registrationNumber)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
