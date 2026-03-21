'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, addWeeks, addDays, isSameWeek, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import {
    Clock,
    MapPin,
    Loader2,
    AlertCircle,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    Search,
    Ban,
    CheckCircle,
    RotateCcw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const TIME_ZONE = 'America/Santiago'

interface Field {
    id: string
    name: string
    price?: number
}

interface Booking {
    id: string
    created_at: string
    start_at: string
    end_at: string
    status: string
    total_price: number
    field_id: string
    field?: Field
}

export default function BookingsPage() {
    const [loading, setLoading] = useState(true)
    const [allBookings, setAllBookings] = useState<Booking[]>([])
    const [statusFilter, setStatusFilter] = useState('all')
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [now, setNow] = useState(new Date())

    // Rebook state - no pre-check, verify on confirm
    const [rebookSlot, setRebookSlot] = useState<{
        date: string
        startTime: string
        endTime: string
        field: Field
        price: number
    } | null>(null)
    const [bookingLoading, setBookingLoading] = useState(false)
    const [bookingError, setBookingError] = useState<string | null>(null)
    const [bookingSuccess, setBookingSuccess] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(interval)
    }, [])

    const fetchBookings = useCallback(async () => {
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
    }, [supabase])

    useEffect(() => {
        fetchBookings()
    }, [fetchBookings])

    const isExpired = useCallback((booking: Booking) => {
        if (booking.status !== 'PENDIENTE_PAGO') return false
        const created = new Date(booking.created_at || booking.start_at)
        const diff = now.getTime() - created.getTime()
        return diff > 10 * 60 * 1000
    }, [now])

    const filteredBookings = useMemo(() => {
        return allBookings.filter(booking => {
            const bookingDate = new Date(booking.start_at)

            if (!isSameWeek(bookingDate, currentWeekStart, { weekStartsOn: 1 })) {
                return false
            }

            if (statusFilter === 'all') return true

            if (statusFilter === 'hold' || statusFilter === 'PENDIENTE_PAGO') {
                if (booking.status !== 'PENDIENTE_PAGO') return false
                return !isExpired(booking)
            }

            if (statusFilter === 'CANCELADA') {
                if (booking.status === 'CANCELADA' || booking.status === 'RECHAZADA') return true
                return isExpired(booking)
            }

            return booking.status === statusFilter
        })
    }, [allBookings, statusFilter, currentWeekStart, isExpired])

    // Availability is checked on confirm, not pre-loaded

    const navigateWeek = (direction: number) => {
        setCurrentWeekStart(prev => addWeeks(prev, direction))
    }

    const handleWhatsApp = (booking: Booking) => {
        const dateStr = format(new Date(booking.start_at), "EEEE d 'de' MMMM", { locale: es })
        const startTime = format(new Date(booking.start_at), 'HH:mm')
        const endTime = format(new Date(booking.end_at), 'HH:mm')

        const message = `Hola! Realicé una reserva para la cancha ${booking.field?.name} el día ${dateStr} de ${startTime} a ${endTime}. Adjunto el comprobante de transferencia.`
        window.open(`https://wa.me/56933355476?text=${encodeURIComponent(message)}`, '_blank')
    }

    const initiateRebook = (booking: Booking) => {
        if (!booking.field) return
        setRebookSlot({
            date: format(new Date(booking.start_at), 'yyyy-MM-dd'),
            startTime: format(new Date(booking.start_at), 'HH:mm'),
            endTime: format(new Date(booking.end_at), 'HH:mm'),
            field: booking.field,
            price: booking.total_price || 35000
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

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId: rebookSlot.field.id,
                    date: rebookSlot.date,
                    startTime: rebookSlot.startTime,
                    endTime: rebookSlot.endTime,
                    userId: user.id,
                    price: rebookSlot.price
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setBookingError(data.error || 'Error al crear la reserva')
                return
            }

            setBookingSuccess(true)
            setRebookSlot(null)
            fetchBookings()
        } catch {
            setBookingError('Ocurrió un error. Intenta nuevamente.')
        } finally {
            setBookingLoading(false)
        }
    }

    const formatPrice = (price: number) => {
        if (!price || isNaN(price)) return '$35.000'
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(price)
    }

    const getStatusBadge = (booking: Booking) => {
        if (booking.status === 'PENDIENTE_PAGO') {
            if (!isExpired(booking)) {
                return <Badge className="bg-amber-500 hover:bg-amber-600 w-full justify-center py-1">Hold</Badge>
            }
            return <Badge variant="destructive" className="w-full justify-center py-1">Expirada</Badge>
        }

        if (booking.status === 'PAGADA') {
            return <Badge className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2 text-sm font-semibold">Pagada</Badge>
        }

        if (booking.status === 'CANCELADA' || booking.status === 'RECHAZADA') {
            return <Badge variant="destructive" className="w-full justify-center py-1">Cancelada</Badge>
        }

        return <Badge className="w-full justify-center py-1">{booking.status}</Badge>
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Mis Reservas</h1>
                <p className="text-muted-foreground">Gestiona tus reservas pasadas y futuras.</p>
            </div>

            {/* Status Filters - Modern Pill Style */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'Todas' },
                    { key: 'PENDIENTE_PAGO', label: 'Pendientes' },
                    { key: 'PAGADA', label: 'Pagadas' },
                    { key: 'hold', label: 'Hold' },
                    { key: 'CANCELADA', label: 'Cancelada' }
                ].map(item => (
                    <button
                        key={item.key}
                        onClick={() => setStatusFilter(item.key)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer",
                            statusFilter === item.key
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                        )}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Date Navigator - Centered */}
            <div className="flex justify-center">
                <div className="flex items-center gap-4 bg-secondary/30 p-2 rounded-xl border border-white/5 max-w-md w-full justify-between">
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="font-semibold text-sm">
                            {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {format(addDays(currentWeekStart, 6), "d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(currentWeekStart, 'yyyy')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Bookings List */}
            <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                    <Card className="text-center py-12 border-dashed">
                        <CardContent>
                            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">No se encontraron reservas</h3>
                            <p className="text-muted-foreground">Prueba cambiando los filtros o la fecha.</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredBookings.map((booking) => {
                        const expired = isExpired(booking)
                        const isCancelled = booking.status === 'CANCELADA' || booking.status === 'RECHAZADA' || expired

                        return (
                            <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-12">
                                        <div className="col-span-2 bg-secondary/20 p-4 flex flex-col items-center justify-center text-center border-r border-border/30">
                                            <span className="text-sm font-medium capitalize text-muted-foreground">
                                                {formatInTimeZone(new Date(booking.start_at), TIME_ZONE, 'EEE', { locale: es })}
                                            </span>
                                            <span className="text-3xl font-bold">
                                                {formatInTimeZone(new Date(booking.start_at), TIME_ZONE, 'd')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatInTimeZone(new Date(booking.start_at), TIME_ZONE, 'HH:mm')}
                                            </span>
                                        </div>

                                        {/* Info Column */}
                                        <div className="col-span-7 p-4 flex flex-col justify-center">
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-primary" />
                                                {booking.field?.name || 'Cancha'}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                <Clock className="w-3 h-3" />
                                                {formatInTimeZone(new Date(booking.start_at), TIME_ZONE, 'HH:mm')} - {formatInTimeZone(new Date(booking.end_at), TIME_ZONE, 'HH:mm')}
                                                <span className="mx-1">•</span>
                                                {Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000)} min
                                            </div>
                                            <div className="font-semibold text-primary mt-1">
                                                {formatPrice(booking.total_price)}
                                            </div>

                                            {/* Hold Timer Bar */}
                                            {booking.status === 'PENDIENTE_PAGO' && !expired && (
                                                <div className="w-full bg-secondary h-1 mt-3 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-amber-500 h-full transition-all"
                                                        style={{
                                                            width: `${Math.max(0, 100 - ((now.getTime() - new Date(booking.created_at).getTime()) / (10 * 60 * 1000)) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Column */}
                                        <div className="col-span-3 p-3 flex flex-col justify-center items-center gap-2 border-l border-border/30 bg-secondary/10">
                                            {booking.status === 'PENDIENTE_PAGO' && !expired ? (
                                                <>
                                                    {getStatusBadge(booking)}
                                                    <Button
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                                        size="sm"
                                                        onClick={() => handleWhatsApp(booking)}
                                                    >
                                                        <MessageCircle className="w-3 h-3 mr-1" /> Pagar
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs text-muted-foreground hover:text-destructive w-full"
                                                    >
                                                        Cancelar
                                                    </Button>
                                                </>
                                            ) : booking.status === 'PAGADA' ? (
                                                <div className="flex items-center justify-center">
                                                    {getStatusBadge(booking)}
                                                </div>
                                            ) : isCancelled ? (
                                                <>
                                                    {getStatusBadge(booking)}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        onClick={() => initiateRebook(booking)}
                                                    >
                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                        Volver a reservar
                                                    </Button>
                                                </>
                                            ) : (
                                                getStatusBadge(booking)
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
                    <Card className="w-full max-w-md">
                        <CardContent className="p-6">
                            <h2 className="text-xl font-bold mb-4">Confirmar Reserva</h2>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cancha:</span>
                                    <span className="font-medium">{rebookSlot.field.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <span className="font-medium">
                                        {format(parseISO(rebookSlot.date), "EEEE d 'de' MMMM", { locale: es })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Horario:</span>
                                    <span className="font-medium">
                                        {rebookSlot.startTime} - {rebookSlot.endTime}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
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
                                    className="flex-1 gradient-primary border-0"
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
            {bookingSuccess && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader className="bg-primary/10 border-b border-border">
                            <CardTitle className="text-center text-primary flex flex-col items-center gap-2">
                                <CheckCircle className="w-12 h-12" />
                                ¡Reserva Iniciada!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                <p className="text-amber-600 font-semibold mb-1">⚠️ Atención</p>
                                <p className="text-sm text-muted-foreground">
                                    Tienes <span className="font-bold text-foreground">10 minutos</span> para realizar el pago.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-center border-b pb-2">Datos de Transferencia</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Banco:</span><span className="font-medium">BICE</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="font-medium">Cuenta Corriente</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Número:</span><span className="font-medium text-lg">21007684</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">RUT:</span><span className="font-medium">77.504.362-8</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Nombre:</span><span className="font-medium">Club FC SPA</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium text-primary">jaravena@f2sports.cl</span></div>
                                </div>
                            </div>

                            <Button className="w-full gradient-primary" onClick={() => setBookingSuccess(false)}>
                                Entendido
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
