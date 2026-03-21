'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
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
    Clock,
    Edit2,
    CalendarRange,
    X,
} from 'lucide-react'
import {
    format,
    addWeeks,
    startOfWeek,
    addDays,
    isBefore,
    isToday,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field, Booking, Profile } from '@/types/domain'
import { cn } from '@/lib/utils'
import { BookingEditModal } from '@/components/admin/BookingEditModal'
import { PatternBookingModal } from '@/components/admin/PatternBookingModal'
import { COURT_SCHEDULES } from '@/lib/courtSchedules'

interface FieldSchedule {
    day_of_week: number
    start_time: string
    end_time: string
}

interface BookingSlotData {
    startTime: string
    endTime: string
    status: 'booked' | 'pending'
}

interface WeekData {
    [date: string]: BookingSlotData[]
}

interface BookingWithDetails extends Booking {
    field?: Field
    user?: Pick<Profile, 'id' | 'full_name' | 'phone'> & { email?: string }
}

const FIELD_ORDER = ['Huelén 7', 'Huelén 5', 'Tabancura 6']

export function AdminCalendarView() {
    const [fields, setFields] = useState<Field[]>([])
    const [selectedField, setSelectedField] = useState<Field | null>(null)
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    )
    const [weekData, setWeekData] = useState<WeekData>({})
    const [allBookings, setAllBookings] = useState<BookingWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [slotsLoading, setSlotsLoading] = useState(false)

    // Edit modal
    const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null)
    const [showEditModal, setShowEditModal] = useState(false)

    // New booking modal (for single slot)
    const [newBookingSlot, setNewBookingSlot] = useState<{ date: string; time: string } | null>(null)

    // Pattern modal
    const [showPatternModal, setShowPatternModal] = useState(false)

    // Week days
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
    }, [currentWeekStart])

    // Field schedule
    const fieldSchedule = useMemo(() => {
        if (!selectedField) return null
        return COURT_SCHEDULES[selectedField.name] || null
    }, [selectedField])

    // Time slots
    const validTimeSlots = useMemo(() => {
        if (!fieldSchedule) return []

        const slots: string[] = []
        const startMinute = fieldSchedule.slotStartMinute

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
            slots.push(`${hour.toString().padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`)
        }

        return slots
    }, [fieldSchedule])

    // Fetch fields
    useEffect(() => {
        const fetchFields = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('fields')
                .select('*')
                .eq('is_active', true)

            if (data) {
                const typedFields = data as Field[]
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

    const fetchWeekBookings = async () => {
        if (!selectedField) return

        setSlotsLoading(true)
        try {
            const startDate = format(currentWeekStart, 'yyyy-MM-dd')
            const endDate = format(addDays(currentWeekStart, 7), 'yyyy-MM-dd')

            // Fetch slots summary
            const slotsResponse = await fetch(
                `/api/availability/week?fieldId=${selectedField.id}&startDate=${startDate}&endDate=${endDate}`
            )
            const slotsData = await slotsResponse.json()
            setWeekData(slotsData.slots || {})

            // Also fetch detailed bookings for this field and week
            // Ensure we cover the full range including timezones
            const bookingsResponse = await fetch(
                `/api/admin/bookings?fieldId=${selectedField.id}&from=${startDate}T00:00:00&to=${endDate}T23:59:59`
            )
            const bookingsData = await bookingsResponse.json()

            // Filter to only bookings in current week and NOT cancelled
            const weekBookings = (bookingsData.bookings || [])
                .filter((b: Booking) => b.status !== 'CANCELADA')
            setAllBookings(weekBookings)
        } catch (error) {
            console.error('Error fetching week data:', error)
            setWeekData({})
        }
        setSlotsLoading(false)
    }

    useEffect(() => {
        fetchWeekBookings()
    }, [selectedField, currentWeekStart])

    // Navigation
    const canGoPrev = useMemo(() => {
        const today = startOfWeek(new Date(), { weekStartsOn: 1 })
        // Allow going back 4 weeks
        return !isBefore(addWeeks(currentWeekStart, -1), addWeeks(today, -4))
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

    // Get slot status
    const getSlotStatus = (day: Date, time: string): 'available' | 'booked' | 'closed' | 'past' | 'pending' | 'blocked' => {
        if (!fieldSchedule) return 'closed'

        const dayOfWeek = day.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const schedule = isWeekend ? fieldSchedule.weekend : fieldSchedule.weekday

        if (!schedule) return 'closed'

        const [slotHour, slotMin] = time.split(':').map(Number)
        const [startHour, startMin] = schedule.start.split(':').map(Number)
        const [endHour, endMin] = schedule.end.split(':').map(Number)

        const slotMinutes = slotHour * 60 + slotMin
        const startMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin

        if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
            return 'closed'
        }

        const now = new Date()
        const slotDate = new Date(day)
        slotDate.setHours(slotHour, slotMin, 0, 0)
        if (isBefore(slotDate, now)) {
            return 'past'
        }

        // 1. Check direct bookings (Admin source of truth)
        const booking = findBookingForSlot(day, time)
        if (booking) {
            if (booking.status === 'BLOQUEADA') return 'blocked'
            return booking.status === 'PENDIENTE_PAGO' ? 'pending' : 'booked'
        }

        // 2. Check blocks (from weekData summary)
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayBookings = weekData[dateStr] || []
        // Note: weekData might also need timezone adjustment if it comes from server as UTC but keys are YYYY-MM-DD
        // Assuming weekData keys are already correct date strings
        if (dayBookings.some((b) => b.startTime === time && b.status === 'booked')) return 'booked'

        return 'available'
    }

    // Find booking for a slot
    const findBookingForSlot = (day: Date, time: string): BookingWithDetails | undefined => {
        const dateStr = format(day, 'yyyy-MM-dd')
        return allBookings.find(b => {
            // Convert booking UTC start_at to Chile time
            const chileDate = toZonedTime(b.start_at, 'America/Santiago')
            const bookingDate = format(chileDate, 'yyyy-MM-dd')
            const bookingTime = format(chileDate, 'HH:mm')
            return bookingDate === dateStr && bookingTime === time
        })
    }

    // Handle slot click
    const handleSlotClick = (day: Date, time: string) => {
        const status = getSlotStatus(day, time)
        const dateStr = format(day, 'yyyy-MM-dd')

        // Single click mode
        if (status === 'booked' || status === 'pending' || status === 'blocked') {
            const booking = findBookingForSlot(day, time)
            if (booking) {
                setEditingBooking(booking)
                setShowEditModal(true)
            } else {
                // Fallback: If status says booked but we can't find details, maybe refresh or alert
                console.warn('Booking not found in details for slot', dateStr, time)
                // Try to find by looser match or just alert
                alert('No se pudieron cargar los detalles de esta reserva. Intente refrescar.')
            }
        } else if (status === 'available') {
            setNewBookingSlot({ date: dateStr, time })
            setShowEditModal(true)
        }
    }

    // Format price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(price)
    }

    // On modal close / save
    const handleModalClose = () => {
        setShowEditModal(false)
        setEditingBooking(null)
        setNewBookingSlot(null)
    }

    const handleBookingSaved = () => {
        handleModalClose()
        fetchWeekBookings()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const renderSlotContent = (status: string, booking?: BookingWithDetails) => {
        if (status === 'booked' || status === 'pending') {
            // Priority: User Full Name > Verification Note (Guest Name) > Generic Fallback
            const userName = booking?.user?.full_name || booking?.verification_note || (booking?.user_id ? 'Usuario' : 'Admin/Invitado')
            return (
                <span className="flex items-center justify-center gap-1 w-full overflow-hidden px-1 pointer-events-none">
                    <Edit2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate text-[10px] leading-tight">
                        {userName}
                    </span>
                </span>
            )
        }
        if (status === 'blocked') {
            return (
                <span className="flex items-center justify-center gap-1 w-full overflow-hidden px-1 pointer-events-none">
                    <X className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate text-[10px] leading-tight">
                        {booking?.user?.full_name || booking?.verification_note || 'Bloqueada'}
                    </span>
                </span>
            )
        }
        if (status === 'available') return 'Reservar'
        if (status === 'closed') return 'Cerrado'
        if (status === 'past') return '-'
        return null
    }

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground whitespace-nowrap">Cancha:</label>
                        <Select
                            value={selectedField?.id || ''}
                            onValueChange={(value) => {
                                const field = fields.find((f) => f.id === value)
                                setSelectedField(field || null)
                            }}
                        >
                            <SelectTrigger className="w-[180px] bg-secondary border-border">
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

                    <div className="h-6 w-px bg-border/50 hidden md:block" />

                    <Button onClick={() => setShowPatternModal(true)} variant="secondary" size="sm">
                        <CalendarRange className="w-4 h-4 mr-2" />
                        Reserva Periódica
                    </Button>
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

            {/* Field Info */}
            {selectedField && fieldSchedule && (
                <div className="gradient-primary rounded-xl p-4 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold">{selectedField.name}</h2>
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

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-medium text-xs">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Disponible
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 font-medium text-xs">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Arrendada
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    Pendiente
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/50 text-purple-400 font-medium text-xs">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Bloqueada
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/20 border border-slate-500/50 text-slate-400 font-medium text-xs">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    Cerrado
                </div>
            </div>

            {/* Weekly Grid */}
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
                                                const booking = findBookingForSlot(day, time)

                                                return (
                                                    <td
                                                        key={`${day.toISOString()}-${time}`}
                                                        className="p-1.5 border-l border-border/30"
                                                    >
                                                        <button
                                                            onClick={() => handleSlotClick(day, time)}
                                                            disabled={status === 'closed' || status === 'past'}
                                                            className={cn(
                                                                'w-full py-2 px-2 rounded-md text-xs font-semibold transition-all duration-150 border relative',
                                                                status === 'available' &&
                                                                'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 cursor-pointer',
                                                                status === 'booked' &&
                                                                'bg-red-500 hover:bg-red-600 text-white border-red-600 cursor-pointer',
                                                                status === 'pending' &&
                                                                'bg-amber-400 hover:bg-amber-500 text-amber-900 border-amber-500 cursor-pointer',
                                                                status === 'blocked' &&
                                                                'bg-purple-500 hover:bg-purple-600 text-white border-purple-600 cursor-pointer',
                                                                status === 'closed' &&
                                                                'bg-slate-600/50 text-slate-400 border-slate-600/50 cursor-not-allowed',
                                                                status === 'past' &&
                                                                'bg-slate-700/30 text-slate-500 border-transparent cursor-not-allowed'
                                                            )}
                                                        >
                                                            {renderSlotContent(status, booking)}
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

            {/* Edit Modal */}
            {showEditModal && (
                <BookingEditModal
                    booking={editingBooking}
                    newSlot={newBookingSlot}
                    field={selectedField}
                    fields={fields}
                    onClose={handleModalClose}
                    onSave={handleBookingSaved}
                />
            )}

            {/* Pattern Modal */}
            {showPatternModal && (
                <PatternBookingModal
                    field={selectedField}
                    fields={fields}
                    onClose={() => setShowPatternModal(false)}
                    onSave={() => {
                        setShowPatternModal(false)
                        fetchWeekBookings()
                    }}
                />
            )}


        </div>
    )
}
