'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { format, startOfWeek, addWeeks, addDays, isSameWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    Loader2,
    AlertCircle,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    Search,
    RotateCcw,
    Ban,
    CheckCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Interfaces
interface Field {
    id: string
    name: string
    price: number // Assuming price is needed for rebooking
}

interface Booking {
    id: string
    created_at: string
    start_at: string
    end_at: string
    status: string
    total_price: number
    field?: Field
    field_id: string // Add field_id to booking interface just in case
}

export default function BookingsPage() {
    const [loading, setLoading] = useState(true)
    const [allBookings, setAllBookings] = useState<Booking[]>([])
    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'PENDIENTE_PAGO', 'PAGADA', 'hold', 'CANCELADA'
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [now, setNow] = useState(new Date())

    // Rebooking & Availability Logic
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({}) // bookingId -> isAvailable
    const [rebookSlot, setRebookSlot] = useState<{
        date: string
        startTime: string
        endTime: string
        field: Field
        price: number
    } | null>(null)
    const [bookingLoading, setBookingLoading] = useState(false)
    const [bookingError, setBookingError] = useState<string | null>(null)
    const [bookingSuccessDetails, setBookingSuccessDetails] = useState<any | null>(null)

    const supabase = createClient()

    // Refresh 'now' for timers
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000) // Every minute
        return () => clearInterval(interval)
    }, [])

    const fetchBookings = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoading(false)
            return
        }

        const { data, error } = await supabase
            .from('bookings')
            .select(`
                *,
                field:fields (
                    id,
                    name
                )
            `)
            .eq('user_id', user.id)
            .order('start_at', { ascending: false })

        if (!error && data) {
            setAllBookings(data as Booking[])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchBookings()
    }, [])

    const isExpired = (booking: Booking) => {
        if (booking.status !== 'PENDIENTE_PAGO') return false
        const created = new Date(booking.created_at || booking.start_at)
        const diff = now.getTime() - created.getTime()
        return diff > 10 * 60 * 1000
    }

    const filteredBookings = useMemo(() => {
        return allBookings.filter(booking => {
            const bookingDate = new Date(booking.start_at)

            // 1. Week Filter
            if (!isSameWeek(bookingDate, currentWeekStart, { weekStartsOn: 1 })) {
                return false
            }

            // 2. Status Filter logic
            if (statusFilter === 'all') return true

            if (statusFilter === 'hold' || statusFilter === 'PENDIENTE_PAGO') {
                if (booking.status !== 'PENDIENTE_PAGO') return false
                return !isExpired(booking) // Only Active
            }

            if (statusFilter === 'CANCELADA') {
                if (booking.status === 'CANCELADA' || booking.status === 'RECHAZADA') return true
                // Include Expired
                return isExpired(booking)
            }

            return booking.status === statusFilter
        })
    }, [allBookings, statusFilter, currentWeekStart, now])

    // Check availability for Cancelled items
    useEffect(() => {
        if (statusFilter !== 'CANCELADA') return

        const checkAvailability = async () => {
            const toCheck = filteredBookings.filter(b =>
                availabilityMap[b.id] === undefined // check if not already checked (could optimize to re-check)
            )

            if (toCheck.length === 0) return

            // We check one by one for now (simplest without bulk API)
            toCheck.forEach(async (booking) => {
                if (!booking.field) return

                const dateStr = format(new Date(booking.start_at), 'yyyy-MM-dd')
                const startStr = format(new Date(booking.start_at), 'HH:mm')

                // Fetch week availability for that field
                // Note: Ideally we'd have a specific endpoint, but we use existing week endpoint
                try {
                    const res = await fetch(`/api/availability/week?fieldId=${booking.field.id}&startDate=${dateStr}&endDate=${dateStr}`)
                    const data = await res.json()

                    if (data && data.slots && data.slots[dateStr]) {
                        const daySlots = data.slots[dateStr]
                        // Check if specific slot is available
                        const slot = daySlots.find((s: any) => s.startTime === startStr)
                        const isAvailable = slot && slot.status === 'available'

                        setAvailabilityMap(prev => ({ ...prev, [booking.id]: isAvailable }))
                    } else {
                        setAvailabilityMap(prev => ({ ...prev, [booking.id]: false }))
                    }
                } catch (e) {
                    console.error("Error checking availability", e)
                    setAvailabilityMap(prev => ({ ...prev, [booking.id]: false }))
                }
            })
        }

        checkAvailability()
    }, [filteredBookings, statusFilter])

    const navigateWeek = (direction: number) => {
        setCurrentWeekStart(prev => addWeeks(prev, direction))
    }

    const handleWhatsApp = (booking: Booking & { field?: Field }) => {
        const dateStr = format(new Date(booking.start_at), "EEEE d 'de' MMMM", { locale: es })
        const startTime = format(new Date(booking.start_at), 'HH:mm')
        const endTime = format(new Date(booking.end_at), 'HH:mm')

        const message = `Hola! Realicé una reserva para la cancha ${booking.field?.name} el día ${dateStr} de ${startTime} a ${endTime}. Adjunto el comprobante de transferencia.`
        const encodedMessage = encodeURIComponent(message)
        window.open(`https://wa.me/56933355476?text=${encodedMessage}`, '_blank')
    }

    const getStatusBadge = (booking: Booking) => {
        if (booking.status === 'PENDIENTE_PAGO') {
            if (!isExpired(booking)) {
                return <Badge className="bg-amber-500 hover:bg-amber-600 w-full justify-center py-1 text-xs uppercase tracking-wider">Hold</Badge>
            }
            return <Badge variant="destructive" className="w-full justify-center py-1 text-xs uppercase tracking-wider">Expirada</Badge>
        }

        if (booking.status === 'PAGADA') {
            return <Badge className="bg-emerald-600 hover:bg-emerald-700 w-full h-full flex items-center justify-center text-sm font-bold uppercase tracking-wider shadow-sm">Pagada</Badge>
        }

        const variants: Record<string, string> = {
            CANCELADA: 'bg-red-500 hover:bg-red-600',
            RECHAZADA: 'bg-red-500 hover:bg-red-600',
        }

        return (
            <Badge className={cn("w-full justify-center py-1 text-xs uppercase tracking-wider", variants[booking.status] || 'bg-slate-500')}>
                {booking.status}
            </Badge>
        )
    }

    // Rebook Flow
    const initiateRebook = (booking: Booking) => {
        if (!booking.field) return
        const dateStr = format(new Date(booking.start_at), 'yyyy-MM-dd')
        const startTime = format(new Date(booking.start_at), 'HH:mm')
        const endTime = format(new Date(booking.end_at), 'HH:mm')

        setRebookSlot({
            date: dateStr,
            startTime: startTime,
            endTime: endTime,
            field: booking.field,
            price: booking.total_price // Use original price or fetch current price? Ideally fetch, but assuming stable for now
        })
        setBookingError(null)
    }

    const confirmRebook = async () => {
        if (!rebookSlot) return
        setBookingLoading(true)
        setBookingError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No autenticado")

            // Create booking
            // Calculate datetime
            const startDateTime = `${rebookSlot.date}T${rebookSlot.startTime}:00`
            const endDateTime = `${rebookSlot.date}T${rebookSlot.endTime}:00`

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId: rebookSlot.field.id,
                    date: rebookSlot.date,
                    startTime: rebookSlot.startTime,
                    endTime: rebookSlot.endTime,
                    userId: user.id,
                    price: rebookSlot.price // careful if price changed
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setBookingError(data.error || 'Error al crear la reserva')
                return
            }

            setBookingSuccessDetails(data)
            setRebookSlot(null) // Close confirm modal
            fetchBookings() // Refresh list
        } catch (err) {
            setBookingError('Ocurrió un error al reservar. Intenta nuevamente.')
        } finally {
            setBookingLoading(false)
        }
    }

    // Format helpers
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(price)
    }

    // Render Logic
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Mis Reservas</h1>
                <p className="text-muted-foreground">Gestiona tus reservas pasadas y futuras.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                    {['all', 'PENDIENTE_PAGO', 'PAGADA', 'hold', 'CANCELADA'].map(status => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            className="capitalize"
                        >
                            {status === 'all' ? 'Todas' :
                                status === 'PENDIENTE_PAGO' ? 'Pendientes' :
                                    status === 'PAGADA' ? 'Pagadas' :
                                        status.toLowerCase()}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Date Navigator (Centered) */}
            <div className="flex justify-center my-4">
                <div className="flex items-center gap-4 bg-secondary/30 p-2 rounded-xl backdrop-blur-sm border border-white/5 shadow-sm max-w-md w-full justify-between">
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)} className="hover:bg-white/10">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="font-bold text-sm">
                            {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {format(addDays(currentWeekStart, 6), "d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(currentWeekStart, "yyyy")}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)} className="hover:bg-white/10">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Bookings List */}
            <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                    <Card className="text-center py-12 border-dashed">
                        <CardContent>
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                <Search className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No se encontraron reservas</h3>
                            <p className="text-muted-foreground">Prueba cambiando los filtros o la fecha seleccionada.</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredBookings.map((booking) => {
                        const expired = isExpired(booking)
                        const isCancelledTabItem = statusFilter === 'CANCELADA' || expired || booking.status === 'CANCELADA' || booking.status === 'RECHAZADA'
                        // Check availability if cancelled (default to false while loading)
                        const canRebook = availabilityMap[booking.id] === true
                        const checkingAvailability = availabilityMap[booking.id] === undefined && isCancelledTabItem

                        return (
                            <Card key={booking.id} className="overflow-hidden hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary">
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-12 gap-0">
                                        {/* Date Column */}
                                        <div className="col-span-3 md:col-span-2 bg-secondary/10 p-4 flex flex-col items-center justify-center text-center border-r border-border/50">
                                            <span className="text-sm font-semibold capitalize text-muted-foreground">
                                                {format(new Date(booking.start_at), 'EEE', { locale: es })}
                                            </span>
                                            <span className="text-2xl font-bold my-1">
                                                {format(new Date(booking.start_at), 'd')}
                                            </span>
                                            <span className="text-xs font-medium">
                                                {format(new Date(booking.start_at), 'HH:mm')}
                                            </span>
                                        </div>

                                        {/* Info Column */}
                                        <div className="col-span-6 md:col-span-8 p-4 flex flex-col justify-center">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                                        <MapPin className="w-4 h-4 text-primary" />
                                                        {booking.field?.name || 'Cancha desconocida'}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(booking.start_at), 'HH:mm')} - {format(new Date(booking.end_at), 'HH:mm')}
                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50 mx-1" />
                                                        {Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000)} min
                                                    </div>
                                                    <div className="font-semibold text-primary">
                                                        {formatPrice(booking.total_price)}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Progress Bar for Hold */}
                                            {booking.status === 'PENDIENTE_PAGO' && !expired && (
                                                <div className="w-full bg-secondary h-1 mt-3 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-amber-500 h-full transition-all duration-1000"
                                                        style={{
                                                            width: `${Math.max(0, 100 - ((now.getTime() - new Date(booking.created_at || booking.start_at).getTime()) / (10 * 60 * 1000)) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Action/Status Column */}
                                        <div className="col-span-3 md:col-span-2 p-2 flex flex-col justify-center items-center gap-2 border-l border-border/50 bg-secondary/5">
                                            {/* Status Badge */}
                                            <div className="w-full">
                                                {getStatusBadge(booking)}
                                            </div>

                                            {/* Dynamic Button */}
                                            {booking.status === 'PENDIENTE_PAGO' && !expired ? (
                                                <>
                                                    <Button
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                                                        size="sm"
                                                        onClick={() => handleWhatsApp(booking)}
                                                    >
                                                        <MessageCircle className="w-3 h-3 mr-1" /> Pagar
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs text-muted-foreground hover:text-destructive w-full"
                                                    >
                                                        Cancelar
                                                    </Button>
                                                </>
                                            ) : null}

                                            {/* Rebook Button for Cancelled/Expired */}
                                            {(booking.status === 'CANCELADA' || booking.status === 'RECHAZADA' || expired) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs h-8 flex items-center justify-center gap-1"
                                                    disabled={!canRebook}
                                                    onClick={() => initiateRebook(booking)}
                                                >
                                                    {checkingAvailability ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : canRebook ? (
                                                        <>
                                                            Reservar de nuevo
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Ban className="w-3 h-3 text-muted-foreground" />
                                                            <span className="opacity-50">Ocupada</span>
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            {/* Rebook Confirmation Modal */}
            {rebookSlot && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md shadow-2xl border-white/10">
                        <CardContent className="p-6">
                            <h2 className="text-xl font-bold mb-4">Confirmar Reserva (Re-booking)</h2>

                            <div className="space-y-3 mb-6 bg-secondary/20 p-4 rounded-lg">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cancha:</span>
                                    <span className="font-medium text-right">{rebookSlot.field.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <span className="font-medium text-right capitalise">
                                        {format(parseISO(rebookSlot.date), "EEEE d 'de' MMMM", { locale: es })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Horario:</span>
                                    <span className="font-medium text-right">
                                        {rebookSlot.startTime} - {rebookSlot.endTime}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border mt-2">
                                    <span>Total:</span>
                                    <span className="text-primary">{formatPrice(rebookSlot.price)}</span>
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
                                    onClick={() => setRebookSlot(null)}
                                    disabled={bookingLoading}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={confirmRebook}
                                    disabled={bookingLoading}
                                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    {bookingLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
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

            {/* Success Modal */}
            {bookingSuccessDetails && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in duration-300 shadow-2xl border-white/10">
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
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Banco:</span>
                                        <span className="font-medium">BICE</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tipo de Cuenta:</span>
                                        <span className="font-medium">Cuenta Corriente</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Número:</span>
                                        <span className="font-medium text-lg">21007684</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">RUT:</span>
                                        <span className="font-medium">77.504.362-8</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Nombre:</span>
                                        <span className="font-medium">Club FC SPA</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-medium text-primary">jaravena@f2sports.cl</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button
                                    className="w-full gradient-primary"
                                    onClick={() => {
                                        setBookingSuccessDetails(null)
                                        // Refresh?
                                        fetchBookings()
                                    }}
                                >
                                    Entendido
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
