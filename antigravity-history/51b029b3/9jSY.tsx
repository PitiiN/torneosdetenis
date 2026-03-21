'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
    CalendarRange,
    User,
    Search,
    Check,
    AlertCircle,
} from 'lucide-react'
import { format, parseISO, eachDayOfInterval, isSameDay, getDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field } from '@/types/domain'

interface UserOption {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
}

interface PatternBookingModalProps {
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

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
]

export function PatternBookingModal({
    field,
    fields,
    onClose,
    onSave,
}: PatternBookingModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{ createdCount: number; conflicts: string[] } | null>(null)

    // Form state
    const [selectedFieldId, setSelectedFieldId] = useState(field?.id || '')
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [selectedDays, setSelectedDays] = useState<number[]>([])

    const [startTime, setStartTime] = useState('18:00')
    const [endTime, setEndTime] = useState('19:00')

    const [selectedStatus, setSelectedStatus] = useState('PAGADA')
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
    const [priceTotal, setPriceTotal] = useState('')

    // Preview
    const [previewDates, setPreviewDates] = useState<string[]>([])

    // User search
    const [userSearch, setUserSearch] = useState('')
    const [userOptions, setUserOptions] = useState<UserOption[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    // Update preview dates when inputs change
    useEffect(() => {
        if (!startDate || !endDate || selectedDays.length === 0) {
            setPreviewDates([])
            return
        }

        try {
            const start = parseISO(startDate)
            const end = parseISO(endDate)

            if (start > end) {
                setPreviewDates([])
                return
            }

            const allDays = eachDayOfInterval({ start, end })
            const matchingDays = allDays.filter(day => selectedDays.includes(getDay(day)))
            const dates = matchingDays.map(d => format(d, 'yyyy-MM-dd'))

            setPreviewDates(dates)
        } catch (e) {
            setPreviewDates([])
        }
    }, [startDate, endDate, selectedDays])

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

    const toggleDay = (dayValue: number) => {
        setSelectedDays(prev =>
            prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue]
        )
    }

    const handleSave = async () => {
        if (previewDates.length === 0) {
            setError('No hay fechas seleccionadas para crear reservas')
            return
        }
        if (!selectedFieldId) {
            setError('Debes seleccionar una cancha')
            return
        }

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
                    dates: previewDates,
                    startTime,
                    endTime,
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarRange className="w-5 h-5 text-primary" />
                        Crear Reserva Periódica
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {result ? (
                        // Success Result
                        <div className="space-y-4">
                            {result.createdCount > 0 ? (
                                <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                    <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="font-bold text-xl mb-2">¡Proceso Completado!</h3>
                                    <p className="text-muted-foreground">
                                        Se crearon exitosamente <span className="font-bold text-foreground">{result.createdCount}</span> reservas.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                                    <AlertCircle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                                    <h3 className="font-bold text-xl mb-2">Sin reservas creadas</h3>
                                    <p className="text-muted-foreground">
                                        No fue posible crear reservas para las fechas seleccionadas debido a conflictos de horario.
                                    </p>
                                </div>
                            )}

                            {result.conflicts.length > 0 && (
                                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-bold">
                                        <AlertCircle className="w-5 h-5" />
                                        <h4>Conflictos de horario ({result.conflicts.length})</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Las siguientes fechas no se pudieron reservar porque ya estaban ocupadas:
                                    </p>
                                    <div className="max-h-40 overflow-y-auto bg-background/50 rounded-md p-2 border border-border/50">
                                        <ul className="text-sm space-y-1">
                                            {result.conflicts.map(date => (
                                                <li key={date} className="flex items-center gap-2 text-muted-foreground">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <Button size="lg" onClick={onSave} className="w-full md:w-auto">
                                    Finalizar y Cerrar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // Form
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Configuration */}
                            <div className="space-y-4">
                                {/* Field */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cancha</label>
                                    <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar cancha" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            {fields.map((f) => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Date Range */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Desde</label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Hasta</label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Days Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Días de la semana</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DAYS_OF_WEEK.map((day) => (
                                            <div key={day.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                    checked={selectedDays.includes(day.value)}
                                                    onCheckedChange={() => toggleDay(day.value)}
                                                />
                                                <label
                                                    htmlFor={`day-${day.value}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {day.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Time Range */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Hora Inicio</label>
                                        <Input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Hora Fin</label>
                                        <Input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: User & Preview */}
                            <div className="space-y-4">
                                {/* User */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Usuario (opcional)</label>
                                    {selectedUser ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-medium truncate">{selectedUser.full_name || 'Sin nombre'}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {selectedUser.email || selectedUser.phone}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={handleClearUser} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                                            )}
                                            {showUserDropdown && userOptions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                                    <div className="p-1">
                                                        {userOptions.map((user) => (
                                                            <button
                                                                key={user.id}
                                                                onClick={() => handleSelectUser(user)}
                                                                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground rounded-md flex items-center gap-3 transition-colors"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                                    <User className="w-4 h-4" />
                                                                </div>
                                                                <div className="overflow-hidden">
                                                                    <p className="font-medium text-sm truncate">{user.full_name || 'Sin nombre'}</p>
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {user.email || user.phone}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Status & Price */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Estado</label>
                                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
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
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Precio (x reserva)</label>
                                        <Input
                                            type="number"
                                            placeholder="35000"
                                            value={priceTotal}
                                            onChange={(e) => setPriceTotal(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Preview Badge */}
                                <div className="pt-2">
                                    <div className="bg-secondary rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-medium text-sm">Resumen de Fechas</h4>
                                            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-bold">
                                                {previewDates.length} Reserva(s)
                                            </span>
                                        </div>
                                        <div className="max-h-[120px] overflow-y-auto text-xs space-y-1 text-muted-foreground custom-scrollbar pr-2">
                                            {previewDates.length > 0 ? (
                                                previewDates.map(date => (
                                                    <div key={date}>{format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es })}</div>
                                                ))
                                            ) : (
                                                <p className="text-muted-foreground italic">
                                                    Selecciona un rango de fechas y al menos un día de la semana.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                                        Cancelar
                                    </Button>
                                    <Button onClick={handleSave} className="flex-1" disabled={loading || previewDates.length === 0}>
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            `Confirmar Ciclo`
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
