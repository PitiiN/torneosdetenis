'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    Plus,
    Edit2,
    CalendarPlus,
    CalendarRange,
    Check,
    X,

} from 'lucide-react'
import {
    format,
    addWeeks,
    startOfWeek,
    addDays,
    isBefore,
    isToday,
    parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field, Booking, Profile } from '@/types/domain'
import { cn } from '@/lib/utils'
import { BookingEditModal } from '@/components/admin/BookingEditModal'

import { PatternBookingModal } from '@/components/admin/PatternBookingModal'

interface FieldSchedule {
    day_of_week: number
    start_time: string
    end_time: string
}

interface BookingSlotData {
    startTime: string
    endTime: string
    status: 'booked' | 'pending'
    bookingId?: string
    userName?: string
}

interface WeekData {
    [date: string]: BookingSlotData[]
}

interface BookingWithDetails extends Booking {
    field?: Field
    user?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'>
}

// Court schedules
const COURT_SCHEDULES: Record<string, {
    weekday: { start: string; end: string };
    weekend: { start: string; end: string } | null;
    pricePerHour: number;
    slotStartMinute: number;
}> = {
    'Huelén 7': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 35000,
        slotStartMinute: 30,
    },
    'Huelén 5': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 15000,
        slotStartMinute: 30,
    },
    'Tabancura 6': {
        weekday: { start: '19:00', end: '22:00' },
        weekend: null,
        pricePerHour: 30000,
        slotStartMinute: 0,
    },
}

const FIELD_ORDER = ['Huelén 7', 'Huelén 5', 'Tabancura 6']

export default function AdminAvailabilityPage() {
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

    // ... (Memoized values remain the same)

    // Handle slot click
    const handleSlotClick = (day: Date, time: string) => {
        const status = getSlotStatus(day, time)
        const dateStr = format(day, 'yyyy-MM-dd')

        // Single click mode
        if (status === 'booked' || status === 'pending') {
            const booking = findBookingForSlot(day, time)
            if (booking) {
                setEditingBooking(booking)
                setShowEditModal(true)
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

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Disponibilidad (Admin)</h1>
                    <p className="text-muted-foreground">
                        Gestiona reservas y crea reservas periódicas
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowPatternModal(true)}>
                        <CalendarRange className="w-4 h-4 mr-2" />
                        Reserva Periódica
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

            {/* Controls */}
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

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-medium text-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Disponible
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 font-medium text-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Arrendada
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium text-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Pendiente
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-500/20 border border-slate-500/50 text-slate-400 font-medium text-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
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
                                                                status === 'closed' &&
                                                                'bg-slate-600/50 text-slate-400 border-slate-600/50 cursor-not-allowed',
                                                                status === 'past' &&
                                                                'bg-slate-700/30 text-slate-500 border-transparent cursor-not-allowed'
                                                            )}
                                                        >
                                                            {status === 'available' && 'Reservar'}
                                                            {status === 'booked' && (
                                                                <span className="flex items-center justify-center gap-1">
                                                                    <Edit2 className="w-3 h-3" />
                                                                    {booking?.user?.full_name?.split(' ')[0] || 'Editar'}
                                                                </span>
                                                            )}
                                                            {status === 'pending' && (
                                                                <span className="flex items-center justify-center gap-1">
                                                                    <Edit2 className="w-3 h-3" />
                                                                    Pendiente
                                                                </span>
                                                            )}
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
