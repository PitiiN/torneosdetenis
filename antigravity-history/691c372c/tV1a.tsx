'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
    CalendarDays,
    Clock,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    ArrowRight,
} from 'lucide-react'
import type { Booking, Field } from '@/types/domain'

interface DashboardStats {
    totalBookings: number
    pendingPayment: number
    inVerification: number
    confirmed: number
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats>({
        totalBookings: 0,
        pendingPayment: 0,
        inVerification: 0,
        confirmed: 0,
    })
    const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { field?: Field })[]>([])
    const [fields, setFields] = useState<Field[]>([])

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()

            // Fetch user's bookings
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*, field:fields(*)')
                .gte('start_at', new Date().toISOString())
                .order('start_at', { ascending: true })
                .limit(5)

            if (bookings) {
                setUpcomingBookings(bookings as (Booking & { field?: Field })[])

                // Calculate stats
                const { data: allBookings } = await supabase
                    .from('bookings')
                    .select('status')

                if (allBookings) {
                    const typedBookings = allBookings as { status: string }[]
                    setStats({
                        totalBookings: typedBookings.length,
                        pendingPayment: typedBookings.filter(b => b.status === 'PENDIENTE_PAGO').length,
                        inVerification: typedBookings.filter(b => b.status === 'EN_VERIFICACION').length,
                        confirmed: typedBookings.filter(b => b.status === 'PAGADA').length,
                    })
                }
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
    }, [])

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
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Bienvenido a tu panel de reservas</p>
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
                                            <p className="text-sm text-muted-foreground">
                                                {field.location_text || 'Ubicación no especificada'}
                                            </p>
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
