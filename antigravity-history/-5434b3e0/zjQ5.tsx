'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    X,
    Loader2,
    CreditCard,
    Check,
    Calendar,
    MapPin,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface DebtorBooking {
    id: string
    fieldName: string
    startAt: string
    status: string
    priceTotalCents: number
}

interface Debtor {
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    unpaidBookings: DebtorBooking[]
    totalDebtCents: number
}

interface BulkPaymentModalProps {
    debtor: Debtor
    onClose: () => void
    onSave: () => void
}

export function BulkPaymentModal({ debtor, onClose, onSave }: BulkPaymentModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(debtor.unpaidBookings.map(b => b.id))
    )

    const toggleBooking = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const toggleAll = () => {
        if (selectedIds.size === debtor.unpaidBookings.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(debtor.unpaidBookings.map(b => b.id)))
        }
    }

    const selectedTotal = debtor.unpaidBookings
        .filter(b => selectedIds.has(b.id))
        .reduce((sum, b) => sum + b.priceTotalCents, 0)

    const formatMoney = (cents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(cents / 100)
    }

    const handleSubmit = async () => {
        if (selectedIds.size === 0) return

        setLoading(true)
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
                setLoading(false)
                return
            }

            setSuccess(true)
        } catch {
            setError('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Marcar Pagos - {debtor.fullName}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {success ? (
                        // Success state
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Check className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="font-semibold text-lg mb-2">¡Pagos Registrados!</h3>
                            <p className="text-muted-foreground mb-4">
                                Se marcaron {selectedIds.size} reservas como pagadas
                            </p>
                            <Button onClick={onSave}>Cerrar</Button>
                        </div>
                    ) : (
                        <>
                            {/* User info */}
                            <div className="p-3 rounded-lg bg-secondary">
                                <p className="font-medium">{debtor.fullName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {debtor.email || debtor.phone}
                                </p>
                            </div>

                            {/* Select all */}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={toggleAll}
                                    className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                                >
                                    <Checkbox
                                        checked={selectedIds.size === debtor.unpaidBookings.length}
                                    />
                                    <span>Seleccionar todas</span>
                                </button>
                                <span className="text-sm text-muted-foreground">
                                    {selectedIds.size} de {debtor.unpaidBookings.length} seleccionadas
                                </span>
                            </div>

                            {/* Bookings list */}
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {debtor.unpaidBookings.map((booking) => (
                                    <button
                                        key={booking.id}
                                        onClick={() => toggleBooking(booking.id)}
                                        className={`w-full p-3 rounded-lg text-left transition-colors flex items-start gap-3 ${selectedIds.has(booking.id)
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'bg-secondary/50 hover:bg-secondary'
                                            }`}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(booking.id)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                                                <span className="font-medium truncate">
                                                    {booking.fieldName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="w-3 h-3 shrink-0" />
                                                <span>
                                                    {format(parseISO(booking.startAt), "EEE d 'de' MMM, HH:mm", { locale: es })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-medium">
                                                {formatMoney(booking.priceTotalCents)}
                                            </p>
                                            <p className={`text-xs ${booking.status === 'PENDIENTE_PAGO'
                                                    ? 'text-yellow-500'
                                                    : 'text-blue-500'
                                                }`}>
                                                {booking.status === 'PENDIENTE_PAGO' ? 'Pendiente' : 'En verificación'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Total a marcar como pagado:</span>
                                    <span className="text-xl font-bold text-green-500">
                                        {formatMoney(selectedTotal)}
                                    </span>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    className="flex-1"
                                    disabled={loading || selectedIds.size === 0}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Marcar Pagadas ({selectedIds.size})
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
