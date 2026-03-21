'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    X,
    Loader2,
    CalendarPlus,
    User,
    Search,
    Check,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field, Profile } from '@/types/domain'

interface UserOption {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
}

interface RecurringBookingModalProps {
    selectedSlots: Array<{ date: string; time: string }>
    field: Field | null
    fields: Field[]
    onClose: () => void
    onSave: () => void
}

const STATUS_OPTIONS = [
    { value: 'PAGADA', label: 'Pagada', color: 'bg-green-500' },
    { value: 'PENDIENTE_PAGO', label: 'Pendiente Pago', color: 'bg-yellow-500' },
    { value: 'BLOQUEADA', label: 'Bloqueada', color: 'bg-purple-500' },
]

export function RecurringBookingModal({
    selectedSlots,
    field,
    fields,
    onClose,
    onSave,
}: RecurringBookingModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{ createdCount: number; conflicts: string[] } | null>(null)

    // Form state
    const [selectedFieldId, setSelectedFieldId] = useState(field?.id || '')
    const [selectedStatus, setSelectedStatus] = useState('PAGADA')
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
    const [priceTotal, setPriceTotal] = useState('')

    // Derive times from first slot
    const firstSlot = selectedSlots[0]
    const [startH, startM] = firstSlot?.time.split(':').map(Number) || [0, 0]
    const endTime = `${(startH + 1).toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`
    const dates = selectedSlots.map(s => s.date)

    // User search
    const [userSearch, setUserSearch] = useState('')
    const [userOptions, setUserOptions] = useState<UserOption[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    // Search users
    useEffect(() => {
        const searchUsers = async () => {
            if (userSearch.length < 2) {
                setUserOptions([])
                return
            }

            setSearchingUsers(true)
            try {
                const response = await fetch(`/api/admin/users?q=${encodeURIComponent(userSearch)}`)
                const data = await response.json()
                setUserOptions(data.users || [])
            } catch {
                setUserOptions([])
            }
            setSearchingUsers(false)
        }

        const debounce = setTimeout(searchUsers, 300)
        return () => clearTimeout(debounce)
    }, [userSearch])

    const handleSelectUser = (user: UserOption) => {
        setSelectedUserId(user.id)
        setSelectedUser(user)
        setShowUserDropdown(false)
        setUserSearch('')
    }

    const handleClearUser = () => {
        setSelectedUserId(null)
        setSelectedUser(null)
    }

    const handleSave = async () => {
        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/admin/bookings/recurring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId: selectedFieldId,
                    userId: selectedUserId,
                    dates: dates,
                    startTime: firstSlot.time,
                    endTime: endTime,
                    status: selectedStatus,
                    priceTotalCents: priceTotal ? Math.round(parseFloat(priceTotal) * 100) : 0,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Error al crear las reservas')
                setLoading(false)
                return
            }

            setResult({
                createdCount: data.createdCount,
                conflicts: data.conflicts || [],
            })
        } catch {
            setError('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarPlus className="w-5 h-5" />
                        Reserva Periódica ({selectedSlots.length} fechas)
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {result ? (
                        // Success state
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                <Check className="w-12 h-12 mx-auto text-green-500 mb-2" />
                                <h3 className="font-semibold text-lg">¡Reservas Creadas!</h3>
                                <p className="text-muted-foreground">
                                    Se crearon {result.createdCount} reservas exitosamente
                                </p>
                            </div>

                            {result.conflicts.length > 0 && (
                                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <h4 className="font-medium text-amber-500 mb-2">
                                        Fechas con conflicto ({result.conflicts.length}):
                                    </h4>
                                    <ul className="text-sm text-muted-foreground">
                                        {result.conflicts.map(date => (
                                            <li key={date}>
                                                {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <Button className="w-full" onClick={onSave}>
                                Cerrar
                            </Button>
                        </div>
                    ) : (
                        // Form state
                        <>
                            {/* Dates summary */}
                            <div className="p-3 rounded-lg bg-secondary">
                                <h4 className="font-medium mb-2">Fechas seleccionadas:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {dates.slice(0, 5).map(date => (
                                        <span key={date} className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-medium">
                                            {format(parseISO(date), "EEE dd/MM", { locale: es })}
                                        </span>
                                    ))}
                                    {dates.length > 5 && (
                                        <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs">
                                            +{dates.length - 5} más
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Horario: {firstSlot?.time} - {endTime}
                                </p>
                            </div>

                            {/* Field */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cancha</label>
                                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar cancha" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fields.map((f) => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Estado</label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                                    {status.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* User */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Usuario (opcional)</label>
                                {selectedUser ? (
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{selectedUser.full_name || 'Sin nombre'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {selectedUser.email || selectedUser.phone}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleClearUser}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar usuario..."
                                                value={userSearch}
                                                onChange={(e) => {
                                                    setUserSearch(e.target.value)
                                                    setShowUserDropdown(true)
                                                }}
                                                onFocus={() => setShowUserDropdown(true)}
                                                className="pl-10"
                                            />
                                            {searchingUsers && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                                            )}
                                        </div>
                                        {showUserDropdown && userOptions.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {userOptions.map((user) => (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => handleSelectUser(user)}
                                                        className="w-full px-3 py-2 text-left hover:bg-secondary flex items-center gap-2"
                                                    >
                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">{user.full_name || 'Sin nombre'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {user.email || user.phone}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Price */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Precio por reserva (CLP)</label>
                                <Input
                                    type="number"
                                    placeholder="35000"
                                    value={priceTotal}
                                    onChange={(e) => setPriceTotal(e.target.value)}
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleSave} className="flex-1" disabled={loading}>
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Crear {dates.length} Reservas
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
