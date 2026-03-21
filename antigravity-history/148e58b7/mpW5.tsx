'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle,
    AlertCircle,
    Clock,
    MapPin,
} from 'lucide-react'
import {
    format,
    addWeeks,
    startOfWeek,
    addDays,
    isBefore,
    isToday,
    parseISO,
    isSameDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field } from '@/types/domain'
import { cn } from '@/lib/utils'
import { toZonedTime } from 'date-fns-tz'

interface FieldSchedule {
    day_of_week: number // 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time: string // "18:30"
    end_time: string // "23:30"
}

interface BookingSlot {
    date: string
    startTime: string
    endTime: string
    startAt: string
    endAt: string
    status: 'available' | 'booked' | 'closed' | 'pending' | 'blocked'
}

interface WeekData {
    [date: string]: BookingSlot[]
}

// Court schedules - slots start at specified times in 60-min blocks
const COURT_SCHEDULES: Record<string, {
    weekday: { start: string; end: string };
    weekend: { start: string; end: string } | null;
    pricePerHour: number;
    slotStartMinute: number; // 0 or 30
}> = {
    'Huelén 7': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 35000,
        slotStartMinute: 30, // Blocks at :30
    },
    'Huelén 5': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 15000,
        slotStartMinute: 30, // Blocks at :30
    },
    'Tabancura 6': {
        weekday: { start: '19:00', end: '22:00' }, // Last bookable slot: 21:00-22:00
        weekend: null, // Closed on weekends
        pricePerHour: 30000,
        slotStartMinute: 0, // Blocks at :00
    },
}

// Custom field order
const FIELD_ORDER = ['Huelén 7', 'Huelén 5', 'Tabancura 6']

export default function AvailabilityPage() {
    const router = useRouter()
    const [fields, setFields] = useState<Field[]>([])
    const [selectedField, setSelectedField] = useState<Field | null>(null)
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday start
    )
    const [weekData, setWeekData] = useState<WeekData>({})
    const [loading, setLoading] = useState(true)
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null)
    const [bookingLoading, setBookingLoading] = useState(false)
    const [bookingError, setBookingError] = useState<string | null>(null)
    // Removed boolean success, using object for success state
    const [bookingDetails, setBookingDetails] = useState<any | null>(null)

    // Generate week days
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
    }, [currentWeekStart])

    // Get schedule for selected field
    const fieldSchedule = useMemo(() => {
        if (!selectedField) return null
        return COURT_SCHEDULES[selectedField.name] || null
    }, [selectedField])

    // Generate time slots dynamically based on selected field schedule
    const validTimeSlots = useMemo(() => {
        if (!fieldSchedule) return []

        const slots: string[] = []
        const startMinute = fieldSchedule.slotStartMinute

        // Generate slots from earliest possible start (09:30 or 19:00) to latest end (23:30 or 22:00)
        // Only show slots that could be valid for this court
        const earliestStart = fieldSchedule.weekend
            ? Math.min(
                parseInt(fieldSchedule.weekday.start.split(':')[0]),
                parseInt(fieldSchedule.weekend.start.split(':')[0])
            )
            : parseInt(fieldSchedule.weekday.start.split(':')[0])

        const latestEnd = fieldSchedule.weekend
            ? Math.max(
                parseInt(fieldSchedule.weekday.end.split(':')[0]),
                parseInt(fieldSchedule.weekend.end.split(':')[0])
            )
            : parseInt(fieldSchedule.weekday.end.split(':')[0])

        for (let hour = earliestStart; hour < latestEnd; hour++) {
            // Only add slots at the correct minute mark
            slots.push(`${hour.toString().padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`)
        }

        return slots
    }, [fieldSchedule])

    // Fetch fields on mount
    useEffect(() => {
        const fetchFields = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('fields')
                .select('*')
                .eq('is_active', true)

            if (data) {
                const typedFields = data as Field[]
                // Sort by custom order
                typedFields.sort((a, b) => {
                    const aIndex = FIELD_ORDER.indexOf(a.name)
                    const bIndex = FIELD_ORDER.indexOf(b.name)
                    if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name)
                    if (aIndex === -1) return 1
                    if (bIndex === -1) return -1
                    return aIndex - bIndex
                })
                setFields(typedFields)
                if (typedFields.length > 0) {
                    setSelectedField(typedFields[0])
                }
            }
            setLoading(false)
        }
        fetchFields()
    }, [])

    // Fetch week bookings when field or week changes
    useEffect(() => {
        if (!selectedField) return

        const fetchWeekBookings = async () => {
            setSlotsLoading(true)
            try {
                const startDate = format(currentWeekStart, 'yyyy-MM-dd')
                const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd')

                const response = await fetch(
                    `/api/availability/week?fieldId=${selectedField.id}&startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`,
                    { cache: 'no-store' }
                )
                const data = await response.json()
                setWeekData(data.slots || {})
            } catch (error) {
                console.error('Error fetching week data:', error)
                setWeekData({})
            }
            setSlotsLoading(false)
        }
        fetchWeekBookings()
        // Reset selected slot when switching fields
        setSelectedSlot(null)
    }, [selectedField, currentWeekStart])

    // Check if we can go to previous week (only if it's not in the past)
    const canGoPrev = useMemo(() => {
        const today = startOfWeek(new Date(), { weekStartsOn: 1 })
        return !isBefore(addWeeks(currentWeekStart, -1), today)
    }, [currentWeekStart])

    const handlePrevWeek = () => {
        if (canGoPrev) {
            setCurrentWeekStart((d) => addWeeks(d, -1))
        }
    }

    const handleNextWeek = () => {
        setCurrentWeekStart((d) => addWeeks(d, 1))
    }

    import { toZonedTime } from 'date-fns-tz'

    // ... (keep previous imports)

    // Determine slot status for a given day and time
    const getSlotStatus = (day: Date, time: string): 'available' | 'booked' | 'closed' | 'past' | 'pending' | 'blocked' => {
        if (!fieldSchedule) return 'closed'

        const dayOfWeek = day.getDay() // 0=Sunday, 6=Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const schedule = isWeekend ? fieldSchedule.weekend : fieldSchedule.weekday

        // Check if closed
        if (!schedule) return 'closed'

        // Check if time is within operating hours
        const [slotHour, slotMin] = time.split(':').map(Number)
        const [startHour, startMin] = schedule.start.split(':').map(Number)
        const [endHour, endMin] = schedule.end.split(':').map(Number)

        const slotMinutes = slotHour * 60 + slotMin
        const startMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin

        if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
            return 'closed'
        }

        // Check if this slot is in the past
        const now = new Date()
        const slotDate = new Date(day)
        slotDate.setHours(slotHour, slotMin, 0, 0)
        if (isBefore(slotDate, now)) {
            return 'past'
        }

        // Check if booked
        // Convert day to Chile timezone to match API keys
        const chileDate = toZonedTime(day, 'America/Santiago')
        const dateStr = format(chileDate, 'yyyy-MM-dd')

        const dayBookings = weekData[dateStr] || []
        // Blocked takes precedence
        if (dayBookings.some((b) => b.startTime === time && b.status === 'blocked')) return 'blocked'
        if (dayBookings.some((b) => b.startTime === time && b.status === 'booked')) return 'booked'
        if (dayBookings.some((b) => b.startTime === time && b.status === 'pending')) return 'pending'

        return 'available'
    }

    const handleSlotClick = (day: Date, time: string) => {
        const status = getSlotStatus(day, time)
        if (status !== 'available') return

        // Calculate end time (1 hour later)
        const [hour, min] = time.split(':').map(Number)
        const endHour = hour + 1
        const endTime = `${endHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`

        const dateStr = format(day, 'yyyy-MM-dd')
        setSelectedSlot({
            date: dateStr,
            startTime: time,
            endTime,
            startAt: `${dateStr}T${time}:00-03:00`, // Chile timezone
            endAt: `${dateStr}T${endTime}:00-03:00`, // Chile timezone
            status: 'available',
        })
        setBookingError(null)
        setBookingDetails(null)
    }

    const handleConfirmBooking = async () => {
        if (!selectedSlot || !selectedField) return

        setBookingLoading(true)
        setBookingError(null)

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId: selectedField.id,
                    startAt: selectedSlot.startAt,
                    endAt: selectedSlot.endAt,
                    durationMinutes: 60,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setBookingError(data.error || 'Error al crear la reserva')
                return
            }

            setBookingDetails(data)
            setSelectedSlot(null)

            // Refresh week data
            const startDate = format(currentWeekStart, 'yyyy-MM-dd')
            const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd')
            const slotsResponse = await fetch(
                `/api/availability/week?fieldId=${selectedField.id}&startDate=${startDate}&endDate=${endDate}`
            )
            const slotsData = await slotsResponse.json()
            setWeekData(slotsData.slots || {})
        } catch {
            setBookingError('Error de conexión. Intenta de nuevo.')
        } finally {
            setBookingLoading(false)
        }
    }

    const cancelSlotSelection = () => {
        setSelectedSlot(null)
        setBookingError(null)
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(price)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header with Field Info */}
            {selectedField && fieldSchedule && (
                <div className="gradient-primary rounded-xl p-4 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold">{selectedField.name}</h1>
                            <p className="text-sm opacity-90">
                                {formatPrice(fieldSchedule.pricePerHour)}/hora
                            </p>
                        </div>
                        <div className="text-sm opacity-90">
                            <p className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Lun-Vie: {fieldSchedule.weekday.start} - {fieldSchedule.weekday.end}
                            </p>
                            {fieldSchedule.weekend ? (
                                <p>Sáb-Dom: {fieldSchedule.weekend.start} - {fieldSchedule.weekend.end}</p>
                            ) : (
                                <p>Sáb-Dom: Cerrado</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Controls: Field Selector + Week Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Cancha:</label>
                    <Select
                        value={selectedField?.id || ''}
                        onValueChange={(value) => {
                            const field = fields.find((f) => f.id === value)
                            setSelectedField(field || null)
                        }}
                    >
                        <SelectTrigger className="w-[160px] bg-secondary border-border">
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                            {fields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                    {field.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePrevWeek}
                        disabled={!canGoPrev}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="min-w-[200px] text-center text-sm font-medium">
                        {format(currentWeekStart, "d 'de' MMMM", { locale: es })} -{' '}
                        {format(addDays(currentWeekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Legend - Modern Pill Badges */}
            <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-medium text-sm shadow-sm hover:bg-emerald-500/30 transition-colors cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Disponible
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 font-medium text-sm shadow-sm hover:bg-red-500/30 transition-colors cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Arrendada
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium text-sm shadow-sm hover:bg-amber-500/30 transition-colors cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    Hold (Reservando)
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-500/20 border border-slate-500/50 text-slate-400 font-medium text-sm shadow-sm hover:bg-slate-500/30 transition-colors cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    Cerrado
                </div>
            </div>

            {/* Success Message */}


            {/* Weekly Grid - Table Style */}
            <Card className="overflow-hidden border-0 bg-card/50">
                <CardContent className="p-0">
                    {slotsLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] border-collapse">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="p-3 text-left text-sm font-bold text-muted-foreground bg-secondary/30 sticky left-0 z-10 w-20">
                                            Hora
                                        </th>
                                        {weekDays.map((day) => (
                                            <th
                                                key={day.toISOString()}
                                                className={cn(
                                                    'p-3 text-center text-sm font-semibold border-l border-border/30',
                                                    isToday(day)
                                                        ? 'bg-primary/20 text-primary'
                                                        : 'bg-secondary/20'
                                                )}
                                            >
                                                <div className="capitalize font-bold">
                                                    {format(day, 'EEEE', { locale: es })}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-normal">
                                                    {format(day, 'dd-MM-yyyy')}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {validTimeSlots.map((time: string) => (
                                        <tr key={time} className="border-b border-border/30 hover:bg-secondary/10">
                                            <td className="p-3 text-sm font-bold text-muted-foreground bg-secondary/20 sticky left-0 z-10 border-r border-border/30">
                                                {time}
                                            </td>
                                            {weekDays.map((day) => {
                                                const status = getSlotStatus(day, time)
                                                const dateStr = format(day, 'yyyy-MM-dd')
                                                const isSelected =
                                                    selectedSlot?.date === dateStr &&
                                                    selectedSlot?.startTime === time

                                                return (
                                                    <td
                                                        key={`${day.toISOString()}-${time}`}
                                                        className="p-1.5 border-l border-border/30"
                                                    >
                                                        <button
                                                            onClick={() => handleSlotClick(day, time)}
                                                            disabled={status !== 'available'}
                                                            className={cn(
                                                                'w-full py-2 px-3 rounded-md text-xs font-semibold transition-all duration-150 border',
                                                                status === 'available' &&
                                                                'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 cursor-pointer shadow-sm hover:shadow-md',
                                                                status === 'booked' &&
                                                                'bg-red-500 text-white border-red-600 cursor-not-allowed',
                                                                status === 'pending' &&
                                                                'bg-amber-400 text-amber-900 border-amber-500 cursor-not-allowed font-bold dashed-border',
                                                                status === 'blocked' &&
                                                                'bg-purple-500 text-white border-purple-600 cursor-not-allowed',
                                                                status === 'closed' &&
                                                                'bg-slate-600/50 text-slate-400 border-slate-600/50 cursor-not-allowed',
                                                                status === 'past' &&
                                                                'bg-slate-700/30 text-slate-500 border-transparent cursor-not-allowed',
                                                                isSelected &&
                                                                'ring-2 ring-primary ring-offset-1 ring-offset-background'
                                                            )}
                                                        >
                                                            {status === 'available' && 'Reservar'}
                                                            {status === 'booked' && 'Arrendada'}
                                                            {status === 'pending' && 'Hold'}
                                                            {status === 'blocked' && 'Bloqueada'}
                                                            {status === 'closed' && 'Cerrado'}
                                                            {status === 'past' && '-'}
                                                        </button>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Booking Confirmation Modal */}
            {selectedSlot && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardContent className="p-6">
                            <h2 className="text-xl font-bold mb-4">Confirmar Reserva</h2>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cancha:</span>
                                    <span className="font-medium">{selectedField?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <span className="font-medium">
                                        {format(parseISO(selectedSlot.date), "EEEE d 'de' MMMM", {
                                            locale: es,
                                        })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Horario:</span>
                                    <span className="font-medium">
                                        {selectedSlot.startTime} - {selectedSlot.endTime}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                                    <span>Total:</span>
                                    <span className="text-primary">
                                        {fieldSchedule && formatPrice(fieldSchedule.pricePerHour)}
                                    </span>
                                </div>
                            </div>

                            {bookingError && (
                                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {bookingError}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={cancelSlotSelection}
                                    disabled={bookingLoading}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleConfirmBooking}
                                    disabled={bookingLoading}
                                    className="flex-1 gradient-primary border-0"
                                >
                                    {bookingLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Reservando...
                                        </>
                                    ) : (
                                        'Confirmar'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Success / Bank Details Modal */}
            {bookingDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in duration-300">
                        <CardHeader className="bg-primary/10 rounded-t-lg border-b border-border">
                            <CardTitle className="text-center text-primary flex flex-col items-center gap-2">
                                <CheckCircle className="w-12 h-12" />
                                <span>¡Reserva Iniciada!</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                <p className="text-amber-600 font-semibold mb-1">⚠️ Atención</p>
                                <p className="text-sm text-balance text-muted-foreground">
                                    Tienes <span className="font-bold text-foreground">10 minutos</span> para realizar el pago,
                                    de lo contrario la reserva pasará a estado expirado automáticamente.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-center border-b pb-2">Datos de Transferencia</h3>
                                <div className="space-y-2 text-sm flex flex-col items-center text-center">
                                    <div className="font-medium text-lg">BICE</div>
                                    <div className="font-medium text-muted-foreground">Cuenta Corriente</div>
                                    <div className="font-bold text-2xl tracking-wider">21007684</div>
                                    <div className="font-medium">77.504.362-8</div>
                                    <div className="font-medium">Club FC SPA</div>
                                    <div className="font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">jaravena@f2sports.cl</div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button
                                    className="w-full gradient-primary"
                                    onClick={() => router.push('/bookings')}
                                >
                                    Ir a Mis Reservas
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full text-muted-foreground hover:text-foreground"
                                    onClick={() => setBookingDetails(null)}
                                >
                                    Cerrar
                                </Button>
                                <p className="text-xs text-center text-muted-foreground">
                                    Podrás adjuntar el comprobante vía WhatsApp desde tus reservas.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

