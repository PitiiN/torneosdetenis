'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    CheckCircle,
    Eye,
    MessageCircle,
    Clock,
    CalendarDays,
    Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
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

    // Update timer every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    // Fetch bookings and user profile
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
            // Sort by earliest date first
            list.sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
            setAllBookings(list)
        } catch (error) {
            console.error('Error fetching bookings:', error)
        }
        setLoading(false)
    }

    // Filter bookings client-side - instant, no loading
    const bookings = useMemo(() => {
        if (statusFilter === 'all') return allBookings
        return allBookings.filter(booking => booking.status === statusFilter)
    }, [allBookings, statusFilter])

    // Remove file upload handlers (handleFileChange, handleUploadProof) since we use WhatsApp now

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
                fetchBookings() // Reload to update status or remove
            }
        } catch (error) {
            console.error('Error canceling booking:', error)
        }
    }

    const getStatusBadge = (status: string) => {
        if (status === 'EXPIRADA') {
            return <Badge variant="destructive">Expirada</Badge>
        }
        const variants: Record<string, 'pendiente' | 'verificacion' | 'pagada' | 'rechazada' | 'cancelada' | 'bloqueada'> = {
            'PENDIENTE_PAGO': 'pendiente',
            'EN_VERIFICACION': 'verificacion',
            'PAGADA': 'pagada',
            'RECHAZADA': 'rechazada',
            'CANCELADA': 'cancelada',
            'BLOQUEADA': 'bloqueada',
        }
        const labels: Record<string, string> = {
            'PENDIENTE_PAGO': 'Pendiente Pago',
            'EN_VERIFICACION': 'En Verificación',
            'PAGADA': 'Pagada',
            'RECHAZADA': 'Rechazada',
            'CANCELADA': 'Cancelada',
            'BLOQUEADA': 'Bloqueada',
        }
        return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Mis Reservas</h1>
                    <p className="text-muted-foreground">
                        Gestiona tus reservas y sube comprobantes de pago
                    </p>
                </div>
                <Button onClick={() => router.push('/availability')}>
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Nueva Reserva
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'PENDIENTE_PAGO', 'EN_VERIFICACION', 'PAGADA', 'CANCELADA'].map((status) => (
                    <Button
                        key={status}
                        variant={statusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                            statusFilter === status && 'gradient-primary border-0 shadow-lg shadow-primary/30'
                        )}
                    >
                        {status === 'all'
                            ? 'Todas'
                            : status === 'PENDIENTE_PAGO'
                                ? 'Pendientes'
                                : status === 'EN_VERIFICACION'
                                    ? 'En Verificación'
                                    : status === 'PAGADA'
                                        ? 'Pagadas'
                                        : 'Canceladas'}
                    </Button>
                ))}
            </div>

            {/* Bookings List */}
            {bookings.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No tienes reservas</p>
                        <Button className="mt-4" onClick={() => router.push('/availability')}>
                            Reservar ahora
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {bookings.map((booking) => (
                        <Card key={booking.id}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-medium">{booking.field?.name || 'Cancha'}</h3>
                                            {getStatusBadge(booking.status)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(booking.start_at), "EEEE, d 'de' MMMM yyyy", {
                                                locale: es,
                                            })}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(booking.start_at), 'HH:mm')} -{' '}
                                            {format(new Date(booking.end_at), 'HH:mm')}
                                        </p>
                                        {booking.verification_note && (
                                            <p className="mt-2 text-sm text-destructive">
                                                Nota: {booking.verification_note}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {booking.status === 'PENDIENTE_PAGO' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleWhatsApp(booking)}
                                                >
                                                    <MessageCircle className="w-4 h-4 mr-1" />
                                                    Enviar Comprobante
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCancelBooking(booking.id)}
                                                >
                                                    Cancelar
                                                </Button>
                                                {/* Timer Check */}
                                                {(() => {
                                                    const created = new Date(booking.created_at || booking.start_at) // Fallback if created_at missing
                                                    const expires = new Date(created.getTime() + 10 * 60 * 1000)
                                                    const diff = expires.getTime() - now.getTime()
                                                    const minutesLeft = Math.ceil(diff / 60000)

                                                    if (diff > 0) {
                                                        return (
                                                            <div className="flex items-center text-xs text-amber-600 font-medium">
                                                                <Clock className="w-3 h-3 mr-1" />
                                                                Expira en {minutesLeft} min
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                            </>
                                        )}
                                        {booking.status === 'EN_VERIFICACION' && (
                                            <Badge variant="verificacion" className="justify-center">
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                Verificando...
                                            </Badge>
                                        )}
                                        {booking.status === 'PAGADA' && (
                                            <Badge variant="pagada" className="justify-center">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Confirmada
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div >
    )
}
