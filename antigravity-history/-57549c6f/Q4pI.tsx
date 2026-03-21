'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
    CalendarDays,
    User,
    Search,
    Save,
    Trash2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field, Booking, Profile } from '@/types/domain'

interface BookingWithDetails extends Booking {
    field?: Field
    user?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'>
}

interface UserOption {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
}

interface BookingEditModalProps {
    booking: BookingWithDetails | null
    newSlot: { date: string; time: string } | null
    field: Field | null
    fields: Field[]
    onClose: () => void
    onSave: () => void
}

const STATUS_OPTIONS = [
    { value: 'PENDIENTE_PAGO', label: 'Pendiente Pago', color: 'bg-yellow-500' },
    { value: 'EN_VERIFICACION', label: 'En Verificación', color: 'bg-blue-500' },
    { value: 'PAGADA', label: 'Pagada', color: 'bg-green-500' },
    { value: 'RECHAZADA', label: 'Rechazada', color: 'bg-red-500' },
    { value: 'CANCELADA', label: 'Cancelada', color: 'bg-gray-500' },
    { value: 'BLOQUEADA', label: 'Bloqueada', color: 'bg-purple-500' },
]

export function BookingEditModal({
    booking,
    newSlot,
    field,
    fields,
    onClose,
    onSave,
}: BookingEditModalProps) {
    const isNewBooking = !booking
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [selectedFieldId, setSelectedFieldId] = useState(
        booking?.field_id || field?.id || ''
    )
    const [selectedDate, setSelectedDate] = useState(
        booking ? format(new Date(booking.start_at), 'yyyy-MM-dd') : newSlot?.date || ''
    )
    const [selectedStartTime, setSelectedStartTime] = useState(
        booking ? format(new Date(booking.start_at), 'HH:mm') : newSlot?.time || ''
    )
    const [selectedEndTime, setSelectedEndTime] = useState(
        booking ? format(new Date(booking.end_at), 'HH:mm') : ''
    )
    const [selectedStatus, setSelectedStatus] = useState(
        booking?.status || 'PAGADA'
    )
    const [selectedUserId, setSelectedUserId] = useState<string | null>(
        booking?.user_id || null
    )
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(
        booking?.user ? {
            id: booking.user.id,
            full_name: booking.user.full_name || null,
            email: (booking.user.email as string) || null,
            phone: booking.user.phone || null,
        } : null
    )
    const [priceTotal, setPriceTotal] = useState(
        booking?.price_total_cents ? (booking.price_total_cents / 100).toString() : ''
    )
    const [note, setNote] = useState(booking?.verification_note || '')

    // User search
    const [userSearch, setUserSearch] = useState('')
    const [userOptions, setUserOptions] = useState<UserOption[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    // Calculate end time when start time changes
    useEffect(() => {
        if (selectedStartTime && !selectedEndTime) {
            const [hour, min] = selectedStartTime.split(':').map(Number)
            const endHour = hour + 1
            setSelectedEndTime(`${endHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
        }
    }, [selectedStartTime])

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

        try {
            const startAt = `${selectedDate}T${selectedStartTime}:00-03:00`
            const endAt = `${selectedDate}T${selectedEndTime}:00-03:00`

            const [startH, startM] = selectedStartTime.split(':').map(Number)
            const [endH, endM] = selectedEndTime.split(':').map(Number)
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)

            if (durationMinutes <= 0) {
                setError('La hora de fin debe ser posterior a la hora de inicio')
                setLoading(false)
                return
            }

            if (isNewBooking) {
                // Create new booking using recurring endpoint with single date
                const response = await fetch('/api/admin/bookings/recurring', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fieldId: selectedFieldId,
                        userId: selectedUserId,
                        dates: [selectedDate],
                        startTime: selectedStartTime,
                        endTime: selectedEndTime,
                        status: selectedStatus,
                        priceTotalCents: priceTotal ? Math.round(parseFloat(priceTotal) * 100) : 0,
                    }),
                })

                const data = await response.json()

                if (!response.ok) {
                    setError(data.error || 'Error al crear la reserva')
                    setLoading(false)
                    return
                }
            } else {
                // Update existing booking
                const response = await fetch(`/api/admin/bookings/${booking.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        field_id: selectedFieldId,
                        user_id: selectedUserId,
                        start_at: startAt,
                        end_at: endAt,
                        duration_minutes: durationMinutes,
                        status: selectedStatus,
                        price_total_cents: priceTotal ? Math.round(parseFloat(priceTotal) * 100) : 0,
                        verification_note: note || undefined,
                    }),
                })

                const data = await response.json()

                if (!response.ok) {
                    setError(data.error || 'Error al actualizar la reserva')
                    setLoading(false)
                    return
                }
            }

            onSave()
        } catch {
            setError('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(cents / 100)
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        {isNewBooking ? 'Nueva Reserva' : 'Editar Reserva'}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
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

                    {/* Date & Time */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha</label>
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Inicio</label>
                            <Input
                                type="time"
                                value={selectedStartTime}
                                onChange={(e) => setSelectedStartTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fin</label>
                            <Input
                                type="time"
                                value={selectedEndTime}
                                onChange={(e) => setSelectedEndTime(e.target.value)}
                            />
                        </div>
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
                                        placeholder="Buscar por nombre, email o teléfono..."
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
                        <label className="text-sm font-medium">Precio Total (CLP)</label>
                        <Input
                            type="number"
                            placeholder="35000"
                            value={priceTotal}
                            onChange={(e) => setPriceTotal(e.target.value)}
                        />
                    </div>

                    {/* Note */}
                    {!isNewBooking && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nota de verificación</label>
                            <Input
                                placeholder="Nota opcional..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                    )}

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
                                    <Save className="w-4 h-4 mr-2" />
                                    {isNewBooking ? 'Crear' : 'Guardar'}
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
