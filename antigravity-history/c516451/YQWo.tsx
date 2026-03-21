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
    AlertCircle,
    Clock,
    ArrowRight,
    DollarSign,
} from 'lucide-react'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'

interface AdminStats {
    totalBookings: number
    pendingVerification: number
    pendingPayment: number
    confirmed: number
    rejected: number
    cancelled: number
    todayBookings: number
}

interface BookingData {
    status: string
    start_at: string
    user_id: string
}

// Generate month options grouped by category
function getMonthOptions() {
    const now = new Date()

    // Group 1: Future & Current
    const futureOptions = []

    // Current Month
    futureOptions.push({
        value: format(now, 'yyyy-MM'),
        label: format(now, 'MMMM yyyy', { locale: es }) + ' (Actual)',
    })

    // Future Months (Next 12 months)
    for (let i = 1; i <= 12; i++) {
        const date = addMonths(now, i)
        futureOptions.push({
            value: format(date, 'yyyy-MM'),
            label: format(date, 'MMMM yyyy', { locale: es }),
        })
    }

    // Group 2: History (Past 12 months)
    const historyOptions = []
    for (let i = 1; i <= 12; i++) {
        const date = subMonths(now, i)
        historyOptions.push({
            value: format(date, 'yyyy-MM'),
            label: format(date, 'MMMM yyyy', { locale: es }),
        })
    }

    return { futureOptions, historyOptions }
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
        todayBookings: 0,
    })
    const [allBookings, setAllBookings] = useState<BookingData[]>([])

    // Get month filter from URL, default to current month
    const currentMonth = format(new Date(), 'yyyy-MM')
    const monthFilter = searchParams.get('month') || currentMonth

    const { futureOptions, historyOptions } = useMemo(() => getMonthOptions(), [])

    // Find label for selected value
    const getSelectedLabel = () => {
        if (monthFilter === 'all') return 'Todo el historial'
        const future = futureOptions.find(o => o.value === monthFilter)
        if (future) return future.label
        const history = historyOptions.find(o => o.value === monthFilter)
        if (history) return history.label
        return monthFilter
    }

    const updateFilter = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('month', value)
        router.push(`/admin?${params.toString()}`, { scroll: false })
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/admin/bookings?summary=true')
                const data = await response.json()
                const bookings = (data.bookings || []) as BookingData[]

                let filteredBookings = bookings

                if (monthFilter !== 'all') {
                    // Filter simply by matching the YYYY-MM string in local time
                    filteredBookings = bookings.filter(b => {
                        const bookingDate = new Date(b.start_at)
                        const bookingMonthStr = format(bookingDate, 'yyyy-MM')
                        return bookingMonthStr === monthFilter
                    })
                }

                setAllBookings(filteredBookings)

                const today = new Date().toISOString().split('T')[0]

                setStats({
                    totalBookings: filteredBookings.length,
                    pendingVerification: filteredBookings.filter(b => b.status === 'EN_VERIFICACION').length,
                    pendingPayment: filteredBookings.filter(b => b.status === 'PENDIENTE_PAGO').length,
                    confirmed: filteredBookings.filter(b => b.status === 'PAGADA').length,
                    rejected: filteredBookings.filter(b => b.status === 'RECHAZADA').length,
                    cancelled: filteredBookings.filter(b => b.status === 'CANCELADA').length,
                    todayBookings: filteredBookings.filter(b => b.start_at.startsWith(today)).length,
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            }
            setLoading(false)
        }

        fetchData()
    }, [monthFilter])

    // Status distribution data for pie chart
    const statusChartData = useMemo(() => {
        return [
            { name: 'Confirmadas', value: stats.confirmed, color: '#22c55e' },
            { name: 'En Verificación', value: stats.pendingVerification, color: '#3b82f6' },
            { name: 'Pendiente Pago', value: stats.pendingPayment, color: '#eab308' },
            { name: 'Rechazadas', value: stats.rejected, color: '#ef4444' },
            { name: 'Canceladas', value: stats.cancelled, color: '#6b7280' },
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
            {/* Header with Month Selector */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Panel Admin</h1>
                    <p className="text-muted-foreground">Resumen de {getSelectedLabel()}</p>
                </div>
                <Select value={monthFilter} onValueChange={updateFilter}>
                    <SelectTrigger className="w-[240px]">
                        <CalendarDays className="w-4 h-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e293b] border-slate-700 shadow-xl">
                        <SelectItem value="all" className="font-medium">
                            Todo el historial
                        </SelectItem>

                        <div className="my-1 border-b" />

                        {/* Group: Future and Current */}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Actual y Próximos
                        </div>
                        {futureOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}

                        <div className="my-1 border-b" />

                        {/* Group: History */}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Historial
                        </div>
                        {historyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards - 3 cards now */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            en {getSelectedLabel()}
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
            </div>

            {/* Charts and Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Distribución por Estado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statusChartData.length > 0 ? (
                            <StatusPieChart data={statusChartData} title="" />
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                Sin reservas en este período
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Period Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle>Resumen del Período</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total reservas</span>
                            <span className="font-medium">{stats.totalBookings}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Confirmadas</span>
                            <span className="font-medium text-green-500">{stats.confirmed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">En verificación</span>
                            <span className="font-medium text-blue-500">{stats.pendingVerification}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Pendientes pago</span>
                            <span className="font-medium text-yellow-500">{stats.pendingPayment}</span>
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

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Link href="/admin/bookings">
                        <Button variant="outline">
                            <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                            Verificar Pagos ({stats.pendingVerification})
                        </Button>
                    </Link>
                    <Link href="/admin/availability">
                        <Button variant="outline">
                            <CalendarDays className="w-4 h-4 mr-2" />
                            Ver Disponibilidad
                        </Button>
                    </Link>
                    <Link href="/admin/financial">
                        <Button variant="outline">
                            <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                            Panel Financiero
                        </Button>
                    </Link>
                    <Link href="/admin/blocks">
                        <Button variant="outline">
                            <Clock className="w-4 h-4 mr-2" />
                            Gestionar Bloqueos
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
