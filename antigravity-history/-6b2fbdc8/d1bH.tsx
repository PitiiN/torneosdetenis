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
    CalendarDays,
    Upload,
    X,
    AlertCircle,
    Loader2,
    CheckCircle,
    Eye,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Booking, Field } from '@/types/domain'
import { cn } from '@/lib/utils'

export default function BookingsPage() {
    const router = useRouter()
    const [allBookings, setAllBookings] = useState<(Booking & { field?: Field })[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedBooking, setSelectedBooking] = useState<string | null>(null)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // Fetch all bookings once on mount
    useEffect(() => {
        fetchBookings()
    }, [])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/bookings')
            const data = await response.json()
            setAllBookings(data.bookings || [])
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0])
            setUploadError(null)
        }
    }

    const handleUploadProof = async (bookingId: string) => {
        if (!uploadFile) {
            setUploadError('Selecciona un archivo')
            return
        }

        setUploading(true)
        setUploadError(null)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setUploadError('No autenticado')
                return
            }

            // Upload file to storage
            const fileName = `${Date.now()}-${uploadFile.name}`
            const filePath = `user/${user.id}/booking/${bookingId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, uploadFile)

            if (uploadError) {
                setUploadError('Error al subir archivo')
                console.error(uploadError)
                return
            }

            // Update booking with proof path
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentProofPath: filePath,
                }),
            })

            if (!response.ok) {
                setUploadError('Error al actualizar reserva')
                return
            }

            // Refresh bookings
            fetchBookings()
            setSelectedBooking(null)
            setUploadFile(null)
        } catch {
            setUploadError('Error de conexión')
        } finally {
            setUploading(false)
        }
    }

    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm('¿Estás seguro de cancelar esta reserva?')) return

        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CANCELADA' }),
            })

            if (response.ok) {
                fetchBookings()
            }
        } catch (error) {
            console.error('Error cancelling booking:', error)
        }
    }

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
                                                    onClick={() => setSelectedBooking(booking.id)}
                                                >
                                                    <Upload className="w-4 h-4 mr-1" />
                                                    Subir Comprobante
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCancelBooking(booking.id)}
                                                >
                                                    Cancelar
                                                </Button>
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

                                {/* Upload Modal */}
                                {selectedBooking === booking.id && (
                                    <div className="mt-4 p-4 rounded-lg bg-secondary border border-border">
                                        <div className="flex items-center justify-between mb-4">
                                            <Label>Subir Comprobante de Pago</Label>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedBooking(null)
                                                    setUploadFile(null)
                                                    setUploadError(null)
                                                }}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <Input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={handleFileChange}
                                            className="mb-4"
                                        />

                                        {uploadError && (
                                            <div className="mb-4 p-2 rounded bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4" />
                                                {uploadError}
                                            </div>
                                        )}

                                        <Button
                                            onClick={() => handleUploadProof(booking.id)}
                                            disabled={!uploadFile || uploading}
                                            className="w-full"
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Subiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Subir Comprobante
                                                </>
                                            )}
                                        </Button>
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
