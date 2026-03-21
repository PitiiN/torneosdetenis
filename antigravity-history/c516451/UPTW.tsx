'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    CalendarDays,
    CheckCircle,
    Clock,
    AlertCircle,
    TrendingUp,
    ArrowRight,
    Users,
    Filter,
    DollarSign,
} from 'lucide-react'
import { BookingsChart } from '@/components/charts/BookingsChart'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface AdminStats {
    totalBookings: number
    pendingVerification: number
    pendingPayment: number
    confirmed: number
    rejected: number
    cancelled: number
    totalUsers: number
    todayBookings: number
}

interface BookingData {
    status: string
    start_at: string
    user_id: string
}

export default function AdminDashboardPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<AdminStats>({
        totalBookings: 0,
        pendingVerification: 0,
        pendingPayment: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        totalUsers: 0,
        todayBookings: 0,
    })
    const [allBookings, setAllBookings] = useState<BookingData[]>([])

    // Get filter from URL
    const periodFilter = searchParams.get('period') || '30d'

    const updateFilter = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', value)
        router.push(`/admin?${params.toString()}`, { scroll: false })
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/admin/bookings')
                const data = await response.json()
                const bookings = (data.bookings || []) as BookingData[]

                // Filter by period
                const days = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90
                const startDate = subDays(new Date(), days)
                const filteredBookings = bookings.filter(b => new Date(b.start_at) >= startDate)

                setAllBookings(filteredBookings)

                const today = new Date().toISOString().split('T')[0]

                setStats({
                    totalBookings: filteredBookings.length,
                    pendingVerification: filteredBookings.filter(b => b.status === 'EN_VERIFICACION').length,
                    pendingPayment: filteredBookings.filter(b => b.status === 'PENDIENTE_PAGO').length,
                    confirmed: filteredBookings.filter(b => b.status === 'PAGADA').length,
                    rejected: filteredBookings.filter(b => b.status === 'RECHAZADA').length,
                    cancelled: filteredBookings.filter(b => b.status === 'CANCELADA').length,
                    totalUsers: new Set(filteredBookings.map(b => b.user_id)).size,
                    todayBookings: filteredBookings.filter(b => b.start_at.startsWith(today)).length,
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            }
            setLoading(false)
        }

        fetchData()
    }, [periodFilter])

    // Generate chart data
    const chartData = useMemo(() => {
        const days = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90
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

    // Status distribution data
    const statusChartData = useMemo(() => {
        return [
            { name: 'Confirmadas', value: stats.confirmed, color: 'hsl(142 76% 36%)' },
            { name: 'En Verificación', value: stats.pendingVerification, color: 'hsl(221 83% 53%)' },
            { name: 'Pendiente Pago', value: stats.pendingPayment, color: 'hsl(48 96% 53%)' },
            { name: 'Rechazadas', value: stats.rejected, color: 'hsl(0 84% 60%)' },
            { name: 'Canceladas', value: stats.cancelled, color: 'hsl(var(--muted))' },
        ].filter(item => item.value > 0)
    }, [stats])

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
                    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Resumen y gestión del sistema</p>
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.todayBookings} hoy
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-yellow-500/20 bg-yellow-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-500">
                            Por Verificar
                        </CardTitle>
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{stats.pendingVerification}</div>
                        <Link href="/admin/bookings">
                            <Button variant="ghost" size="sm" className="mt-1 -ml-2 text-yellow-500 h-auto py-1">
                                Ver pendientes <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </Link>
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalBookings > 0 ? Math.round((stats.confirmed / stats.totalBookings) * 100) : 0}% del total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Usuarios Activos
                        </CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            con reservas
                        </p>
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
                        <BookingsChart data={chartData} title="" />
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

            {/* Quick Actions & Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Acciones Rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href="/admin/bookings" className="block">
                            <Button variant="outline" className="w-full justify-start">
                                <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                                Verificar Pagos ({stats.pendingVerification})
                            </Button>
                        </Link>
                        <Link href="/admin/blocks" className="block">
                            <Button variant="outline" className="w-full justify-start">
                                <Clock className="w-4 h-4 mr-2" />
                                Gestionar Bloqueos
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resumen del Período</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Pendientes pago</span>
                            <span className="font-medium">{stats.pendingPayment}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Rechazadas</span>
                            <span className="font-medium text-red-500">{stats.rejected}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Canceladas</span>
                            <span className="font-medium">{stats.cancelled}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-muted-foreground">Tasa de confirmación</span>
                            <span className="font-medium text-green-500">
                                {stats.totalBookings > 0 ? Math.round((stats.confirmed / stats.totalBookings) * 100) : 0}%
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
