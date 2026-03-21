'use client'

import { useEffect, useState, useRef } from 'react'
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
    CalendarDays,
} from 'lucide-react'
import { format, parseISO, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { BulkPaymentModal } from '@/components/admin/BulkPaymentModal'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'

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

// Generate month options: Past 12 months -> Current -> Future 12 months
function getMonthOptions() {
    const now = new Date()
    const options = []

    // Sort chronological: Oldest to Newest
    // Let's show -12 to +12
    for (let i = -12; i <= 12; i++) {
        const date = addMonths(now, i)
        options.push({
            value: format(date, 'yyyy-MM'),
            label: format(date, 'MMMM yyyy', { locale: es }) + (i === 0 ? ' (Actual)' : ''),
        })
    }

    return options
}

export default function FinancialPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [stats, setStats] = useState<FieldStats[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [debtors, setDebtors] = useState<Debtor[]>([])
    const [totalDebtCents, setTotalDebtCents] = useState(0)

    // Filters
    const currentMonth = format(new Date(), 'yyyy-MM')
    const monthFilter = searchParams.get('month') || currentMonth
    const fieldFilter = searchParams.get('fieldId') || 'all'
    const [fieldsList, setFieldsList] = useState<{ id: string, name: string }[]>([])

    const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)
    const [showBulkPayment, setShowBulkPayment] = useState(false)

    // Memoize options
    const monthOptions = useMemo(() => getMonthOptions(), [])

    // Ref to track if month changed
    const prevMonthRef = useRef(monthFilter)

    const updateFilter = (key: 'month' | 'fieldId', value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(key, value)
        router.push(`/admin/financial?${params.toString()}`, { scroll: false })
    }

    // Get selected labels
    const getMonthLabel = () => {
        const opt = monthOptions.find(o => o.value === monthFilter)
        return opt ? opt.label : monthFilter
    }

    const fetchData = async () => {
        // NOTE: loading state is handled by the useEffect now to distinguish transition types
        try {
            // Fetch available fields for selector
            if (fieldsList.length === 0) {
                const fRes = await fetch('/api/admin/financial?period=30d')
                const fData = await fRes.json()
                if (fData.stats) {
                    setFieldsList(fData.stats.map((s: any) => ({ id: s.fieldId, name: s.fieldName })))
                }
            }

            // Build Query
            const params = new URLSearchParams()
            if (monthFilter !== 'all') params.set('month', monthFilter)
            if (fieldFilter !== 'all') params.set('fieldId', fieldFilter)

            const statsResponse = await fetch(`/api/admin/financial?${params.toString()}`)
            const statsData = await statsResponse.json()
            setStats(statsData.stats || [])
            setSummary(statsData.summary || null)

            // Fetch debtors
            const debtorsParams = new URLSearchParams()
            if (monthFilter) debtorsParams.set('month', monthFilter)
            if (fieldFilter !== 'all') debtorsParams.set('fieldId', fieldFilter)

            const debtorsResponse = await fetch(`/api/admin/field-users?${debtorsParams.toString()}`)
            const debtorsData = await debtorsResponse.json()
            setDebtors(debtorsData.users || [])
            setTotalDebtCents(debtorsData.totalDebtCents || 0)
        } catch (error) {
            console.error('Error fetching financial data:', error)
        } finally {
            setLoading(false)
            setIsTransitioning(false)
        }
    }

    useEffect(() => {
        const monthChanged = prevMonthRef.current !== monthFilter
        // Always update ref immediately? No, update after decision.

        // If initial load (loading is true), we don't mess with it.
        // If not initial load:
        if (!loading) {
            if (monthChanged) {
                setLoading(true)
            } else {
                setIsTransitioning(true)
            }
        }

        // Update ref
        prevMonthRef.current = monthFilter

        // Use a timeout to simulate smoother transition if too fast? No, instant is fine.
        fetchData()
    }, [monthFilter, fieldFilter])

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
                        Resumen: {getMonthLabel()}
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* Field Selector */}
                    <Select
                        value={fieldFilter}
                        onValueChange={(val) => updateFilter('fieldId', val)}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todas las canchas" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1e293b] border-slate-700">
                            <SelectItem value="all">Todas las canchas</SelectItem>
                            {fieldsList.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Month Selector */}
                    <Select
                        value={monthFilter}
                        onValueChange={(val) => updateFilter('month', val)}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1e293b] border-slate-700 h-[300px]">
                            {monthOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
                                En el periodo seleccionado
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

            {/* Users Management List */}
            {fieldFilter !== 'all' && (
                <div className="border rounded-lg bg-[#1e293b] border-slate-700 relative overflow-hidden transition-all duration-300">
                    {/* Loading Overlay */}
                    {isTransitioning && (
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center animate-in fade-in duration-200">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    )}

                    <div className="p-4 border-b border-slate-700">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Gestión de Usuarios
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Usuarios con reservas en esta cancha (Click para gestionar pagos y cancelaciones)
                        </p>
                    </div>
                    <div className="divide-y divide-slate-700 min-h-[100px]">
                        {debtors.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                                <p>No hay usuarios con reservas activas en esta cancha</p>
                            </div>
                        ) : (
                            debtors.map((user) => (
                                <div
                                    key={user.userId}
                                    onClick={() => {
                                        setSelectedDebtor(user)
                                        setShowBulkPayment(true)
                                    }}
                                    className="p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${user.totalDebtCents > 0
                                            ? 'bg-red-500/10 text-red-500 group-hover:bg-red-500/20'
                                            : 'bg-green-500/10 text-green-500 group-hover:bg-green-500/20'
                                            }`}>
                                            {user.totalDebtCents > 0 ? (
                                                <AlertCircle className="w-5 h-5" />
                                            ) : (
                                                <CheckCircle className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium flex items-center gap-2">
                                                {user.fullName}
                                                {user.totalDebtCents === 0 && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                                        Al día
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{user.email || user.phone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div>
                                            {user.totalDebtCents > 0 ? (
                                                <>
                                                    <p className="font-bold text-red-500">
                                                        {formatMoney(user.totalDebtCents)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        por pagar
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    Sin deuda
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {
                showBulkPayment && selectedDebtor && (
                    <BulkPaymentModal
                        debtor={selectedDebtor}
                        fieldId={fieldFilter !== 'all' ? fieldFilter : ''}
                        fieldName={fieldsList.find(f => f.id === fieldFilter)?.name}
                        month={monthFilter}
                        onClose={handleCloseBulkPayment}
                        onSave={handleBulkPaymentSaved}
                    />
                )
            }
        </div >
    )
}
