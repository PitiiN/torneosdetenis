'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import {
    CalendarDays,
    Clock,
    CheckCircle,
    Filter,
    ArrowRight,
    MapPin,
    Calendar,
    CreditCard,
    User,
    Phone,
    Mail,
    HelpCircle
} from 'lucide-react'
import type { Booking, Field } from '@/types/domain'
import { subDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

const TIME_ZONE = 'America/Santiago'

interface DashboardStats {
    totalBookings: number
    pendingPayment: number
    confirmed: number
}

export default function DashboardPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats>({
        totalBookings: 0,
        pendingPayment: 0,
        confirmed: 0,
    })
    const [nextBooking, setNextBooking] = useState<(Booking & { field?: Field }) | null>(null)
    const [userName, setUserName] = useState<string>('')

    // Get filter from URL
    const periodFilter = searchParams.get('period') || '7d'

    const updateFilter = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', value)
        router.push(`/dashboard?${params.toString()}`, { scroll: false })
    }

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()

            // Get User Profile
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
                if (profile?.full_name) setUserName(profile.full_name.split(' ')[0])
            }

            // Fetch user's NEXT booking (only 1)
            const now = new Date().toISOString()
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*, field:fields(*)')
                .gte('start_at', now)
                .neq('status', 'CANCELADA')
                .order('start_at', { ascending: true })
                .limit(1)
                .single()

            if (bookings) {
                setNextBooking(bookings as (Booking & { field?: Field }))
            } else {
                setNextBooking(null)
            }

            // Calculate date range based on filter for stats
            const days = periodFilter === '30d' ? 30 : periodFilter === '7d' ? 7 : 90
            const startDate = subDays(new Date(), days)

            // Fetch all bookings for stats
            const { data: allBookingsData } = await supabase
                .from('bookings')
                .select('status, start_at')
                .gte('start_at', startDate.toISOString())

            if (allBookingsData) {
                const typedBookings = allBookingsData as { status: string; start_at: string }[]
                setStats({
                    totalBookings: typedBookings.length,
                    pendingPayment: typedBookings.filter(b => b.status === 'PENDIENTE_PAGO').length,
                    confirmed: typedBookings.filter(b => b.status === 'PAGADA').length,
                })
            }

            setLoading(false)
        }

        fetchData()
    }, [periodFilter])

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'pendiente' | 'verificacion' | 'pagada' | 'rechazada' | 'cancelada' | 'bloqueada'> = {
            'PENDIENTE_PAGO': 'pendiente',
            'EN_VERIFICACION': 'verificacion',
            'PAGADA': 'pagada',
            'RECHAZADA': 'rechazada',
            'CANCELADA': 'cancelada',
            'BLOQUEADA': 'bloqueada',
        }
        const labels: Record<string, string> = {
            'PENDIENTE_PAGO': 'Pendiente',
            'EN_VERIFICACION': 'En Verificación',
            'PAGADA': 'Confirmada',
            'RECHAZADA': 'Rechazada',
            'CANCELADA': 'Cancelada',
            'BLOQUEADA': 'Bloqueada',
        }
        return <Badge variant={variants[status] || 'secondary'} className="text-sm px-3 py-1">{labels[status] || status}</Badge>
    }

    const formatDate = (dateString: string, formatStr: string) => {
        try {
            return formatInTimeZone(new Date(dateString), TIME_ZONE, formatStr, { locale: es })
        } catch {
            return dateString
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Hola, {userName || 'Jugador'} 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">Este es el resumen de tu actividad deportiva.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={periodFilter} onValueChange={updateFilter}>
                        <SelectTrigger className="w-[150px] bg-secondary/30 border-white/10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Últimos 7 días</SelectItem>
                            <SelectItem value="30d">Últimos 30 días</SelectItem>
                            <SelectItem value="90d">Últimos 90 días</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Next Booking Hero Card */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <Card className="relative border-0 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Calendar className="w-64 h-64 text-primary" />
                    </div>

                    <CardHeader className="pb-2 relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <Badge variant="outline" className="mb-3 border-primary/50 text-primary bg-primary/10">
                                    Próxima Reserva
                                </Badge>
                                <CardTitle className="text-2xl md:text-3xl font-bold">
                                    {nextBooking ? nextBooking.field?.name : 'Sin reservas próximas'}
                                </CardTitle>
                            </div>
                            {nextBooking && getStatusBadge(nextBooking.status)}
                        </div>
                    </CardHeader>

                    <CardContent className="relative z-10">
                        {nextBooking ? (
                            <div className="grid md:grid-cols-3 gap-6 mt-4">
                                <div className="flex items-center gap-3 text-lg">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Fecha</p>
                                        <p className="font-semibold capitalize">
                                            {formatDate(nextBooking.start_at, 'EEEE d MMMM')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-lg">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Horario</p>
                                        <p className="font-semibold">
                                            {formatDate(nextBooking.start_at, 'HH:mm')} - {formatDate(nextBooking.end_at, 'HH:mm')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-lg">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Valor</p>
                                        <p className="font-semibold">
                                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(nextBooking.total_price || 35000)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center md:text-left">
                                <p className="text-muted-foreground text-lg mb-4">
                                    No tienes reservas activas por el momento. ¡Es un buen momento para jugar!
                                </p>
                                <Link href="/availability">
                                    <Button size="lg" className="gradient-primary shadow-lg shadow-primary/25">
                                        Reservar ahora
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Support Card */}
                <Card className="h-full border-border/50 bg-secondary/20">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <HelpCircle className="w-5 h-5 text-primary" />
                            <CardTitle>Centro de Ayuda</CardTitle>
                        </div>
                        <CardDescription className="text-base">
                            ¿Tienes dudas o necesitas ayuda con tu reserva? Nuestro equipo de soporte está disponible para asistirte.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            variant="outline"
                            className="w-full justify-start h-14 text-base border-primary/20 hover:bg-primary/10 hover:border-primary/50 group"
                            onClick={() => window.open('https://wa.me/56912345678', '_blank')}
                        >
                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                <Phone className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-foreground">Contactar por WhatsApp</p>
                                <p className="text-xs text-muted-foreground">Respuesta rápida</p>
                            </div>
                        </Button>

                        <a
                            href="mailto:jaravena@f2sports.cl"
                            className="w-full"
                        >
                            <Button
                                variant="outline"
                                className="w-full justify-start h-14 text-base border-primary/20 hover:bg-primary/10 hover:border-primary/50 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold text-foreground">Enviar Correo</p>
                                    <p className="text-xs text-muted-foreground">jaravena@f2sports.cl</p>
                                </div>
                            </Button>
                        </a>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="h-full border-border/50 bg-secondary/20">
                    <CardHeader>
                        <CardTitle>Acciones Rápidas</CardTitle>
                        <CardDescription>Accesos directos a lo más importante</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Link href="/availability">
                            <Button className="w-full justify-between h-auto py-4 gradient-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5" />
                                    <div className="text-left">
                                        <p className="font-bold">Reservar Ahora</p>
                                        <p className="text-xs opacity-90">Ver disponibilidad actual</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 opacity-80" />
                            </Button>
                        </Link>

                        <div className="grid grid-cols-2 gap-4">
                            <Link href="/bookings">
                                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 items-center justify-center border-border/50 hover:bg-secondary/80">
                                    <CreditCard className="w-6 h-6 text-primary mb-1" />
                                    <span>Mis Reservas</span>
                                </Button>
                            </Link>
                            <Link href="/profile">
                                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 items-center justify-center border-border/50 hover:bg-secondary/80">
                                    <User className="w-6 h-6 text-primary mb-1" />
                                    <span>Mi Perfil</span>
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Simplified Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-secondary/30 border-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Reservas
                        </CardTitle>
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalBookings}</div>
                        <p className="text-xs text-muted-foreground">En el periodo seleccionado</p>
                    </CardContent>
                </Card>

                <Card className="bg-secondary/30 border-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pendientes de Pago
                        </CardTitle>
                        <Clock className="w-4 h-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{stats.pendingPayment}</div>
                        <p className="text-xs text-muted-foreground">Requieren tu atención</p>
                    </CardContent>
                </Card>

                <Card className="bg-secondary/30 border-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Confirmadas
                        </CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{stats.confirmed}</div>
                        <p className="text-xs text-muted-foreground">Listas para jugar</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
