'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    CalendarDays,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    Eye,
    User,
    Phone,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Booking, Field, Profile } from '@/types/domain'
import { cn } from '@/lib/utils'

interface BookingWithDetails extends Booking {
    field?: Field
    user?: Pick<Profile, 'id' | 'full_name' | 'phone'>
}

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<BookingWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('EN_VERIFICACION')
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [selectedProof, setSelectedProof] = useState<string | null>(null)
    const [proofUrl, setProofUrl] = useState<string | null>(null)
    const [verifyNote, setVerifyNote] = useState('')

    useEffect(() => {
        fetchBookings()
    }, [statusFilter])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const url = `/api/admin/bookings?status=${statusFilter}`
            const response = await fetch(url)
            const data = await response.json()
            setBookings(data.bookings || [])
        } catch (error) {
            console.error('Error fetching bookings:', error)
        }
        setLoading(false)
    }

    const handleViewProof = async (booking: BookingWithDetails) => {
        if (!booking.payment_proof_path) return

        setSelectedProof(booking.id)

        const supabase = createClient()
        const { data } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(booking.payment_proof_path, 60 * 5) // 5 minutes

        if (data) {
            setProofUrl(data.signedUrl)
        }
    }

    const handleVerify = async (bookingId: string, action: 'approve' | 'reject') => {
        setProcessingId(bookingId)

        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}/verify`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, note: verifyNote || undefined }),
            })

            if (response.ok) {
                fetchBookings()
                setSelectedProof(null)
                setProofUrl(null)
                setVerifyNote('')
            }
        } catch (error) {
            console.error('Error verifying booking:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'pendiente' | 'verificacion' | 'pagada' | 'cancelada' | 'bloqueada'> = {
            'PENDIENTE_PAGO': 'pendiente',
            'EN_VERIFICACION': 'verificacion',
            'PAGADA': 'pagada',
            'CANCELADA': 'cancelada',
            'BLOQUEADA': 'bloqueada',
        }
        const labels: Record<string, string> = {
            'PENDIENTE_PAGO': 'Pendiente Pago',
            'EN_VERIFICACION': 'En Verificación',
            'PAGADA': 'Pagada',
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
            <div>
                <h1 className="text-2xl font-bold">Verificación de Pagos</h1>
                <p className="text-muted-foreground">
                    Revisa y verifica los comprobantes de pago
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['EN_VERIFICACION', 'PENDIENTE_PAGO', 'PAGADA', 'CANCELADA'].map((status) => (
                    <Button
                        key={status}
                        variant={statusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                    >
                        {status === 'EN_VERIFICACION'
                            ? 'Por Verificar'
                            : status === 'PENDIENTE_PAGO'
                                ? 'Pendientes'
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
                        <p>No hay reservas en este estado</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {bookings.map((booking) => (
                        <Card key={booking.id} className={cn(
                            selectedProof === booking.id && 'ring-2 ring-primary'
                        )}>
                            <CardContent className="p-4">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                    {/* Booking Info */}
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
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {format(new Date(booking.start_at), 'HH:mm')} -{' '}
                                            {format(new Date(booking.end_at), 'HH:mm')}
                                        </p>

                                        {/* User Info */}
                                        <div className="flex items-center gap-4 text-sm mt-2">
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <User className="w-4 h-4" />
                                                {booking.user?.full_name || 'Sin nombre'}
                                            </span>
                                            {booking.user?.phone && (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <Phone className="w-4 h-4" />
                                                    {booking.user.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        {booking.payment_proof_path && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleViewProof(booking)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                Ver Comprobante
                                            </Button>
                                        )}
                                        {booking.status === 'EN_VERIFICACION' && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => handleVerify(booking.id, 'approve')}
                                                    disabled={processingId === booking.id}
                                                >
                                                    {processingId === booking.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                            Aprobar
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleVerify(booking.id, 'reject')}
                                                    disabled={processingId === booking.id}
                                                >
                                                    <XCircle className="w-4 h-4 mr-1" />
                                                    Rechazar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Proof Viewer */}
                                {selectedProof === booking.id && proofUrl && (
                                    <div className="mt-4 p-4 rounded-lg bg-secondary border border-border">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-medium">Comprobante de Pago</h4>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedProof(null)
                                                    setProofUrl(null)
                                                }}
                                            >
                                                Cerrar
                                            </Button>
                                        </div>

                                        <div className="mb-4 max-h-96 overflow-auto rounded-lg bg-black/50 flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={proofUrl}
                                                alt="Comprobante de pago"
                                                className="max-w-full h-auto"
                                            />
                                        </div>

                                        {booking.status === 'EN_VERIFICACION' && (
                                            <>
                                                <Input
                                                    placeholder="Nota opcional (motivo de rechazo, etc.)"
                                                    value={verifyNote}
                                                    onChange={(e) => setVerifyNote(e.target.value)}
                                                    className="mb-4"
                                                />

                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => handleVerify(booking.id, 'approve')}
                                                        disabled={processingId === booking.id}
                                                        className="flex-1"
                                                    >
                                                        {processingId === booking.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                                Aprobar Pago
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        onClick={() => handleVerify(booking.id, 'reject')}
                                                        disabled={processingId === booking.id}
                                                        className="flex-1"
                                                    >
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                        Rechazar
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
