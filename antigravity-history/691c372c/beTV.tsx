'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import {
    CalendarDays,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Filter,
    TrendingUp,
} from 'lucide-react'
import type { Booking, Field } from '@/types/domain'
import { BookingsChart } from '@/components/charts/BookingsChart'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface DashboardStats {
    totalBookings: number
    pendingPayment: number
    inVerification: number
    confirmed: number
}

export default function DashboardPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats>({
        totalBookings: 0,
        pendingPayment: 0,
        inVerification: 0,
        confirmed: 0,
    })
    const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { field?: Field })[]>([])
    const [allBookings, setAllBookings] = useState<{ status: string; start_at: string }[]>([])
    const [fields, setFields] = useState<Field[]>([])

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

            // Fetch user's upcoming bookings
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*, field:fields(*)')
                .gte('start_at', new Date().toISOString())
                .order('start_at', { ascending: true })
                .limit(5)

            if (bookings) {
                setUpcomingBookings(bookings as (Booking & { field?: Field })[])
            }

            // Calculate date range based on filter
            const days = periodFilter === '30d' ? 30 : periodFilter === '7d' ? 7 : 90
            const startDate = subDays(new Date(), days)

            // Fetch all bookings for stats and charts
            const { data: allBookingsData } = await supabase
                .from('bookings')
                .select('status, start_at')
                .gte('start_at', startDate.toISOString())

            if (allBookingsData) {
                const typedBookings = allBookingsData as { status: string; start_at: string }[]
                setAllBookings(typedBookings)
                setStats({
                    totalBookings: typedBookings.length,
                    pendingPayment: typedBookings.filter(b => b.status === 'PENDIENTE_PAGO').length,
                    inVerification: typedBookings.filter(b => b.status === 'EN_VERIFICACION').length,
                    confirmed: typedBookings.filter(b => b.status === 'PAGADA').length,
                })
            }

            // Fetch fields
            const { data: fieldsData } = await supabase
                .from('fields')
                .select('*')
                .eq('is_active', true)

            if (fieldsData) {
                setFields(fieldsData as Field[])
            }

            setLoading(false)
        }

        fetchData()
    }, [periodFilter])

    // Generate chart data for weekly view
    const weeklyChartData = useMemo(() => {
        const days = periodFilter === '30d' ? 30 : periodFilter === '7d' ? 7 : 90
        const endDate = new Date()
        const startDate = subDays(endDate, days - 1)

        const dateRange = eachDayOfInterval({ start: startDate, end: endDate })

        return dateRange.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayBookings = allBookings.filter(b => b.start_at.startsWith(dateStr))

            return {
                name: format(date, days <= 7 ? 'EEE' : 'dd/MM', { locale: es }),
                reservas: dayBookings.length,
                confirmadas: dayBookings.filter(b => b.status === 'PAGADA').length,
            }
        })
    }, [allBookings, periodFilter])

    // Generate status distribution data
    const statusChartData = useMemo(() => {
        return [
            { name: 'Confirmadas', value: stats.confirmed, color: 'hsl(142 76% 36%)' },
            { name: 'En Verificación', value: stats.inVerification, color: 'hsl(221 83% 53%)' },
            { name: 'Pendiente Pago', value: stats.pendingPayment, color: 'hsl(48 96% 53%)' },
            { name: 'Otras', value: stats.totalBookings - stats.confirmed - stats.inVerification - stats.pendingPayment, color: 'hsl(var(--muted))' },
        ].filter(item => item.value > 0)
    }, [stats])

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
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Panel</h1>
                    <p className="text-muted-foreground">Bienvenido a tu panel de reservas</p>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={periodFilter} onValueChange={updateFilter}>
                        <SelectTrigger className="w-[140px]">
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Reservas
                        </CardTitle>
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalBookings}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pendientes de Pago
                        </CardTitle>
                        <Clock className="w-4 h-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{stats.pendingPayment}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            En Verificación
                        </CardTitle>
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{stats.inVerification}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Confirmadas
                        </CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{stats.confirmed}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Tendencia de Reservas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BookingsChart data={weeklyChartData} title="" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Distribución por Estado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statusChartData.length > 0 ? (
                            <StatusPieChart data={statusChartData} title="" />
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                Sin datos disponibles
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Bookings */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Próximas Reservas</CardTitle>
                        <Link href="/bookings">
                            <Button variant="ghost" size="sm">
                                Ver todas <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {upcomingBookings.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No tienes reservas próximas</p>
                                <Link href="/availability">
                                    <Button className="mt-4" size="sm">
                                        Reservar ahora
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingBookings.map((booking) => (
                                    <div
                                        key={booking.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                                    >
                                        <div>
                                            <p className="font-medium">{booking.field?.name || 'Cancha'}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(booking.start_at).toLocaleDateString('es-CL', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}{' '}
                                                {new Date(booking.start_at).toLocaleTimeString('es-CL', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                        {getStatusBadge(booking.status)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Availability */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Canchas Disponibles</CardTitle>
                        <Link href="/availability">
                            <Button variant="ghost" size="sm">
                                Ver disponibilidad <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {fields.map((field) => (
                                <Link
                                    key={field.id}
                                    href={`/availability?fieldId=${field.id}`}
                                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{field.name}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
