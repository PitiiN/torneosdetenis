'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    CalendarDays,
    MessageCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
    MapPin,
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Booking, Field } from '@/types/domain'
import { cn } from '@/lib/utils'

export default function BookingsPage() {
    const router = useRouter()
    const [allBookings, setAllBookings] = useState<(Booking & { field?: Field })[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [userName, setUserName] = useState<string>('')
    const [now, setNow] = useState(new Date())

    // Week Navigation State
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    )

    // Update timer every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        fetchBookings()
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setUserName((profile as any)?.full_name || user.email?.split('@')[0] || 'Usuario')
        }
    }

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/bookings')
            const data = await response.json()
            const list = data.bookings || []
            // Sort by date (descending for general list, but we might want ascending for weekly view?
            // Usually ascending (Monday -> Sunday) is better for weekly view.
            list.sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
            setAllBookings(list)
        } catch (error) {
            console.error('Error fetching bookings:', error)
            alert('Error cargando reservas. Intenta recargar.')
        }
        setLoading(false)
    }

    const filteredBookings = useMemo(() => {
        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

        return allBookings.filter(booking => {
            // 1. Exclude 'EN_VERIFICACION'
            if (booking.status === 'EN_VERIFICACION') return false

            // 2. Week Filter
            // Parse using new Date (handles UTC string)
            // Note: DB returns UTC string. date-fns handles it in Local Time.
            // Ensure visual consistency with Grid? Grid force-converts to Chile.
            // Here 'new Date()' uses Browser Local. If user is in Chile, it works.
            const bookingDate = new Date(booking.start_at)

            // To be safe with edge cases, we check if it falls in the range
            if (!isWithinInterval(bookingDate, { start: currentWeekStart, end: weekEnd })) return false

            // 3. Status Filter
            if (statusFilter === 'all') return true

            if (statusFilter === 'hold' || statusFilter === 'PENDIENTE_PAGO') {
                if (booking.status !== 'PENDIENTE_PAGO') return false
                const created = new Date(booking.created_at || booking.start_at)
                const diff = now.getTime() - created.getTime()
                return diff <= 10 * 60 * 1000 // Only Active
            }

            if (statusFilter === 'CANCELADA') {
                if (booking.status === 'CANCELADA' || booking.status === 'RECHAZADA') return true
                // Also include Expired PENDIENTE_PAGO
                if (booking.status === 'PENDIENTE_PAGO') {
                    const created = new Date(booking.created_at || booking.start_at)
                    const diff = now.getTime() - created.getTime()
                    return diff > 10 * 60 * 1000 // Expired
                }
                return false
            }

            return booking.status === statusFilter
        })
    }, [allBookings, statusFilter, currentWeekStart, now])

    const handleRebook = () => {
        router.push('/availability')
    }

    const handleWhatsApp = (booking: Booking & { field?: Field }) => {
        const dateStr = format(new Date(booking.start_at), "EEEE d 'de' MMMM", { locale: es })
        const startTime = format(new Date(booking.start_at), 'HH:mm')
        const endTime = format(new Date(booking.end_at), 'HH:mm')
        const message = `Hola, soy ${userName}, arrendé la ${booking.field?.name || 'Cancha'}, el ${dateStr} de ${startTime} a ${endTime}, adjunto mi comprobante de pago.`
        const url = `https://wa.me/56995158428?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm('¿Estás seguro de cancelar esta reserva?')) return
        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE',
            })
            if (response.ok) {
                fetchBookings()
            }
        } catch (error) {
            console.error('Error canceling booking:', error)
        }
    }

    const navigateWeek = (direction: number) => {
        setCurrentWeekStart(prev => addWeeks(prev, direction))
    }

    const getStatusBadge = (status: string, createdAt: string) => {
        // Custom Hold Logic
        if (status === 'PENDIENTE_PAGO') {
            const created = new Date(createdAt)
            const diff = now.getTime() - created.getTime()
            if (diff <= 10 * 60 * 1000) {
                return <Badge className="bg-amber-500 hover:bg-amber-600 w-full justify-center py-1">Hold</Badge>
            }
            // Expired
            return <Badge variant="destructive" className="w-full justify-center py-1">Expirada</Badge>
        }

        const variants: Record<string, string> = {
            'PAGADA': 'bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm text-lg py-3 px-6 h-full w-full flex items-center justify-center font-bold tracking-wide uppercase',
            'CANCELADA': 'bg-red-500 hover:bg-red-600 text-white w-full justify-center py-1',
            'RECHAZADA': 'bg-red-500 hover:bg-red-600 text-white w-full justify-center py-1',
        }
        const labels: Record<string, string> = {
            'PAGADA': 'PAGADA',
            'CANCELADA': 'Cancelada',
            'RECHAZADA': 'Rechazada',
        }

        return <Badge className={variants[status] || 'bg-secondary'}>{labels[status] || status}</Badge>
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Mis Reservas</h1>
                    <p className="text-muted-foreground">
                        Gestiona tus partidos y pagos
                    </p>
                </div>
                <Button onClick={() => router.push('/availability')} className="w-full md:w-auto">
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Nueva Reserva
                </Button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'Todas' },
                    { id: 'PENDIENTE_PAGO', label: 'Pendientes' },
                    { id: 'PAGADA', label: 'Pagadas' },
                    { id: 'hold', label: 'Hold' },
                    { id: 'CANCELADA', label: 'Canceladas' },
                ].map((tab) => (
                    <Button
                        key={tab.id}
                        variant={statusFilter === tab.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(tab.id as string)}
                        className={cn(
                            statusFilter === tab.id && 'gradient-primary border-0 shadow-lg shadow-primary/30'
                        )}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Week Navigator */}
            <div className="flex justify-center">
                <div className="flex items-center justify-between bg-card p-3 rounded-lg border shadow-sm w-full max-w-md">
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="font-semibold text-sm">
                            {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {' '}
                            {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {format(currentWeekStart, "yyyy")}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Bookings List */}
            {filteredBookings.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No hay reservas en esta semana</p>
                        {statusFilter !== 'all' && <p className="text-xs mt-1">(Con el filtro seleccionado)</p>}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredBookings.map((booking) => (
                        <Card key={booking.id} className="overflow-hidden transition-all hover:shadow-md">
                            <CardContent className="p-0">
                                <div className="flex flex-col sm:flex-row">
                                    {/* Left: Date/Time Stripe */}
                                    <div className="bg-muted/30 p-4 sm:w-32 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-border min-w-[120px]">
                                        <span className="text-sm font-medium text-muted-foreground capitalize">
                                            {format(new Date(booking.start_at), "EEE", { locale: es })}
                                        </span>
                                        <span className="text-2xl font-bold">
                                            {format(new Date(booking.start_at), "d")}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(booking.start_at), "HH:mm")}
                                        </span>
                                    </div>

                                    {/* Middle: Info */}
                                    <div className="p-4 flex-1">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-primary" />
                                                <h3 className="font-semibold text-lg">{booking.field?.name}</h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {format(new Date(booking.start_at), "HH:mm")} - {format(new Date(booking.end_at), "HH:mm")}
                                            </div>
                                            <div>
                                                60 min
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Actions / Status */}
                                    <div className="p-4 flex flex-row sm:flex-col gap-2 justify-center border-t sm:border-t-0 sm:border-l border-border bg-muted/10 min-w-[140px]">
                                        {booking.status === 'PENDIENTE_PAGO' ? (
                                            <>
                                                {getStatusBadge(booking.status, booking.created_at)}
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                                                    onClick={() => handleWhatsApp(booking)}
                                                >
                                                    <MessageCircle className="w-4 h-4 mr-1" />
                                                    <span className="sm:hidden lg:inline">Pagar</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive w-full h-8"
                                                    onClick={() => handleCancelBooking(booking.id)}
                                                >
                                                    Cancelar
                                                </Button>
                                            </>
                                        ) : (
                                            /* Big Status Badge for Non-Pending (Paid/Cancelled/Expired) */
                                            <div className="h-full w-full flex flex-col gap-2 items-center justify-center">
                                                <div className="w-full h-full flex items-center">
                                                    {getStatusBadge(booking.status, booking.created_at)}
                                                </div>
                                                {(booking.status === 'CANCELADA' || booking.status === 'RECHAZADA' || (booking.status === 'PENDIENTE_PAGO')) && (
                                                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleRebook}>
                                                        Reservar de nuevo
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Timer Bar */}
                                {booking.status === 'PENDIENTE_PAGO' && (() => {
                                    const created = new Date(booking.created_at || booking.start_at)
                                    const diff = now.getTime() - created.getTime()
                                    const timeLeft = 10 * 60 * 1000 - diff
                                    if (timeLeft > 0) {
                                        const width = (timeLeft / (10 * 60 * 1000)) * 100
                                        return <div className="h-1 bg-amber-500 transition-all duration-1000" style={{ width: `${width}%` }} />
                                    }
                                    return null
                                })()}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
