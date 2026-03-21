'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    X,
    Loader2,
    CreditCard,
    Check,
    Calendar,
    MapPin,
    AlertCircle,
    Info
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Booking {
    id: string
    field_id: string
    start_at: string
    status: string
    price_total_cents: number
    field?: { name: string }
}

interface Debtor {
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    totalDebtCents: number
}

interface BulkPaymentModalProps {
    debtor: Debtor
    fieldId: string
    fieldName?: string
    onClose: () => void
    onSave: () => void
}

export function BulkPaymentModal({ debtor, fieldId, fieldName, onClose, onSave }: BulkPaymentModalProps) {
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Fetch full history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const params = new URLSearchParams({
                    userId: debtor.userId,
                    fieldId: fieldId, // Ensure we only get bookings for this field
                })

                const res = await fetch(`/api/admin/bookings?${params.toString()}`)
                const data = await res.json()

                if (data.bookings) {
                    setBookings(data.bookings)
                    // Auto-select unpaid ones
                    const unpaid = data.bookings
                        .filter((b: Booking) => b.status === 'PENDIENTE_PAGO' || b.status === 'EN_VERIFICACION')
                        .map((b: Booking) => b.id)
                    setSelectedIds(new Set(unpaid))
                }
            } catch (err) {
                console.error('Error fetching history:', err)
                setError('Error al cargar historial')
            } finally {
                setLoading(false)
            }
        }

        fetchHistory()
    }, [debtor.userId, fieldId])

    const toggleBooking = (id: string, status: string) => {
        // Only allow toggling unpaid bookings
        if (status !== 'PENDIENTE_PAGO' && status !== 'EN_VERIFICACION') return

        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const toggleAllUnpaid = () => {
        const unpaid = bookings.filter(b => b.status === 'PENDIENTE_PAGO' || b.status === 'EN_VERIFICACION')

        // If all unpaid are selected, deselect all
        // If not all are selected, select all unpaid
        const allUnpaidSelected = unpaid.every(b => selectedIds.has(b.id))

        if (allUnpaidSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(unpaid.map(b => b.id)))
        }
    }

    const selectedTotal = bookings
        .filter(b => selectedIds.has(b.id))
        .reduce((sum, b) => sum + b.price_total_cents, 0)

    const formatMoney = (cents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(cents / 100)
    }

    const handleSubmit = async () => {
        if (selectedIds.size === 0) return

        setProcessing(true)
        setError(null)

        try {
            const response = await fetch('/api/admin/bookings/bulk-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingIds: Array.from(selectedIds),
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Error al procesar el pago')
                setProcessing(false)
                return
            }

            setSuccess(true)
        } catch {
            setError('Error de conexión')
        } finally {
            setProcessing(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAGADA': return 'text-green-500 bg-green-500/10 border-green-500/20'
            case 'PENDIENTE_PAGO': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
            case 'EN_VERIFICACION': return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
            case 'CANCELADA': return 'text-red-500 bg-red-500/10 border-red-500/20'
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAGADA': return 'Pagada'
            case 'PENDIENTE_PAGO': return 'Pendiente'
            case 'EN_VERIFICACION': return 'En Revisión'
            case 'CANCELADA': return 'Cancelada'
            default: return status
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0f172a] border-slate-800 shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <CreditCard className="w-6 h-6 text-primary" />
                            {debtor.fullName}
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            Historial en {fieldName || 'Cancha seleccionada'}
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
                    {success ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                <Check className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="font-bold text-2xl mb-2 text-white">¡Pagos Actualizados!</h3>
                            <p className="text-muted-foreground mb-8 text-lg">
                                Se marcaron {selectedIds.size} reservas como pagadas exitosamente.
                            </p>
                            <Button size="lg" onClick={onSave} className="w-full max-w-xs">
                                Volver al Panel
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Header Info */}
                            <div className="p-4 bg-slate-900/50 flex items-center justify-between border-b border-slate-800">
                                <div className="text-sm text-muted-foreground">
                                    <p>{debtor.email}</p>
                                    <p>{debtor.phone}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Total Deuda</p>
                                    <p className="text-xl font-bold text-red-500">{formatMoney(debtor.totalDebtCents)}</p>
                                </div>
                            </div>

                            {/* Bookings List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : bookings.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No hay historial de reservas para esta cancha/usuario.
                                        {/* This shouldn't happen if they are on the debtor list, 
                                            but maybe they have old cancelled ones */}
                                    </div>
                                ) : (
                                    bookings.map((booking) => {
                                        const isPayable = booking.status === 'PENDIENTE_PAGO' || booking.status === 'EN_VERIFICACION';
                                        const isSelected = selectedIds.has(booking.id);

                                        return (
                                            <div
                                                key={booking.id}
                                                onClick={() => isPayable && toggleBooking(booking.id, booking.status)}
                                                className={`
                                                    relative group p-4 rounded-xl border transition-all duration-200
                                                    ${isPayable
                                                        ? 'cursor-pointer hover:border-slate-600 hover:shadow-lg hover:shadow-black/20'
                                                        : 'opacity-75 bg-slate-900/30 border-slate-800'
                                                    }
                                                    ${isSelected
                                                        ? 'bg-blue-500/5 border-blue-500/50 shadow-md shadow-blue-500/5'
                                                        : 'bg-[#1e293b] border-slate-700'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    {/* Left: Checkbox & Info */}
                                                    <div className="flex items-start gap-4">
                                                        <div className="pt-1">
                                                            {isPayable ? (
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    className={`data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 w-5 h-5 rounded-md transition-colors ${!isSelected ? 'border-slate-600' : ''}`}
                                                                />
                                                            ) : (
                                                                <div className="w-5 h-5 flex items-center justify-center">
                                                                    {booking.status === 'PAGADA' && <Check className="w-4 h-4 text-green-500" />}
                                                                    {booking.status === 'CANCELADA' && <X className="w-4 h-4 text-red-500" />}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-lg">
                                                                    {booking.field?.name || 'Cancha'}
                                                                </span>
                                                                <div className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border ${getStatusColor(booking.status)}`}>
                                                                    {getStatusLabel(booking.status)}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-slate-300 transition-colors">
                                                                <Calendar className="w-3 h-3" />
                                                                {format(parseISO(booking.start_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Price */}
                                                    <div className="text-right">
                                                        <p className={`font-mono font-bold text-lg ${isPayable ? 'text-white' : 'text-muted-foreground'
                                                            }`}>
                                                            {formatMoney(booking.price_total_cents)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-4">
                                {/* Error Message */}
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleAllUnpaid}
                                            className="text-sm text-muted-foreground hover:text-white transition-colors underline decoration-dotted"
                                        >
                                            {selectedIds.size === 0 ? 'Seleccionar pendientes' : 'Deseleccionar todo'}
                                        </button>
                                        <span className="text-slate-600">|</span>
                                        <span className="text-sm font-medium">
                                            {selectedIds.size} seleccionadas
                                        </span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-0.5">Total a Pagar</span>
                                        <span className="text-2xl font-bold text-green-500 block leading-none">
                                            {formatMoney(selectedTotal)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={onClose} disabled={processing} className="hover:bg-slate-800 border-slate-700">
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={processing || selectedIds.size === 0}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                    >
                                        {processing ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <Check className="w-4 h-4 mr-2" />
                                        )}
                                        Confirmar Pago
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
