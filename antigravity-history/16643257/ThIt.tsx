'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    Loader2,
    DollarSign,
    TrendingUp,
    AlertCircle,
    Users,
    Calendar,
    ChevronRight,
    CheckCircle,
    Clock,
    CreditCard,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { BulkPaymentModal } from '@/components/admin/BulkPaymentModal'

interface FieldStats {
    fieldId: string
    fieldName: string
    totalBookings: number
    paidBookings: number
    unpaidBookings: number
    pendingPayment: number
    pendingVerification: number
    totalRevenueCents: number
    pendingRevenueCents: number
}

interface Summary {
    totalBookings: number
    totalPaid: number
    totalUnpaid: number
    totalRevenueCents: number
    pendingRevenueCents: number
    period: string
    startDate: string
    endDate: string
}

interface Debtor {
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    unpaidBookings: Array<{
        id: string
        fieldName: string
        startAt: string
        status: string
        priceTotalCents: number
    }>
    totalDebtCents: number
}

export default function FinancialPage() {
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('30d')
    const [stats, setStats] = useState<FieldStats[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [debtors, setDebtors] = useState<Debtor[]>([])
    const [totalDebtCents, setTotalDebtCents] = useState(0)

    const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)
    const [showBulkPayment, setShowBulkPayment] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch financial stats
            const statsResponse = await fetch(`/api/admin/financial?period=${period}`)
            const statsData = await statsResponse.json()
            setStats(statsData.stats || [])
            setSummary(statsData.summary || null)

            // Fetch debtors
            const debtorsResponse = await fetch('/api/admin/debtors')
            const debtorsData = await debtorsResponse.json()
            setDebtors(debtorsData.debtors || [])
            setTotalDebtCents(debtorsData.totalDebtCents || 0)
        } catch (error) {
            console.error('Error fetching financial data:', error)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [period])

    const formatMoney = (cents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(cents / 100)
    }

    const handleOpenBulkPayment = (debtor: Debtor) => {
        setSelectedDebtor(debtor)
        setShowBulkPayment(true)
    }

    const handleCloseBulkPayment = () => {
        setShowBulkPayment(false)
        setSelectedDebtor(null)
    }

    const handleBulkPaymentSaved = () => {
        handleCloseBulkPayment()
        fetchData()
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Panel Financiero</h1>
                    <p className="text-muted-foreground">
                        Estado de pagos y reservas por cancha
                    </p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
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

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/20 to-transparent border-green-500/30">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Ingresos Confirmados</p>
                                    <p className="text-2xl font-bold text-green-500">
                                        {formatMoney(summary.totalRevenueCents)}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-green-500" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {summary.totalPaid} reservas pagadas
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500/20 to-transparent border-amber-500/30">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Pendiente de Cobro</p>
                                    <p className="text-2xl font-bold text-amber-500">
                                        {formatMoney(summary.pendingRevenueCents)}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-amber-500" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {summary.totalUnpaid} reservas sin pagar
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/20 to-transparent border-blue-500/30">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Reservas</p>
                                    <p className="text-2xl font-bold text-blue-500">
                                        {summary.totalBookings}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-blue-500" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                En los últimos {period === '7d' ? '7' : period === '30d' ? '30' : '90'} días
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500/20 to-transparent border-red-500/30">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Deuda Total</p>
                                    <p className="text-2xl font-bold text-red-500">
                                        {formatMoney(totalDebtCents)}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {debtors.length} usuarios con deuda
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Stats by Field */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Estado por Cancha
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats.map((field) => {
                            const paidPercentage = field.totalBookings > 0
                                ? Math.round((field.paidBookings / field.totalBookings) * 100)
                                : 0

                            return (
                                <div key={field.fieldId} className="p-4 rounded-lg bg-secondary/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="font-semibold">{field.fieldName}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {field.totalBookings} reservas en el período
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-green-500">
                                                {formatMoney(field.totalRevenueCents)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">confirmado</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden mb-3">
                                        <div
                                            className="h-full bg-green-500 transition-all"
                                            style={{ width: `${paidPercentage}%` }}
                                        />
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span>{field.paidBookings} pagadas</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4 text-yellow-500" />
                                            <span>{field.pendingPayment} pendientes</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4 text-blue-500" />
                                            <span>{field.pendingVerification} en verificación</span>
                                        </div>
                                        {field.pendingRevenueCents > 0 && (
                                            <div className="flex items-center gap-1 text-amber-500">
                                                <DollarSign className="w-4 h-4" />
                                                <span>{formatMoney(field.pendingRevenueCents)} por cobrar</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Debtors List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Usuarios con Deuda
                    </CardTitle>
                    <CardDescription>
                        Click en un usuario para marcar sus reservas como pagadas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {debtors.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No hay usuarios con deudas pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {debtors.map((debtor) => (
                                <button
                                    key={debtor.userId}
                                    onClick={() => handleOpenBulkPayment(debtor)}
                                    className="w-full p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{debtor.fullName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {debtor.email || debtor.phone}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-semibold text-red-500">
                                                {formatMoney(debtor.totalDebtCents)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {debtor.unpaidBookings.length} reservas
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk Payment Modal */}
            {showBulkPayment && selectedDebtor && (
                <BulkPaymentModal
                    debtor={selectedDebtor}
                    onClose={handleCloseBulkPayment}
                    onSave={handleBulkPaymentSaved}
                />
            )}
        </div>
    )
}
