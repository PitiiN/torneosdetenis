'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    CalendarDays,
    CheckCircle,
    Clock,
    AlertCircle,
    TrendingUp,
    ArrowRight,
    Users,
} from 'lucide-react'

interface AdminStats {
    totalBookings: number
    pendingVerification: number
    pendingPayment: number
    confirmed: number
    totalUsers: number
    todayBookings: number
}

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<AdminStats>({
        totalBookings: 0,
        pendingVerification: 0,
        pendingPayment: 0,
        confirmed: 0,
        totalUsers: 0,
        todayBookings: 0,
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch booking stats
                const response = await fetch('/api/admin/bookings')
                const data = await response.json()
                const bookings = data.bookings || []

                const today = new Date().toISOString().split('T')[0]

                setStats({
                    totalBookings: bookings.length,
                    pendingVerification: bookings.filter((b: { status: string }) => b.status === 'EN_VERIFICACION').length,
                    pendingPayment: bookings.filter((b: { status: string }) => b.status === 'PENDIENTE_PAGO').length,
                    confirmed: bookings.filter((b: { status: string }) => b.status === 'PAGADA').length,
                    totalUsers: new Set(bookings.map((b: { user_id: string }) => b.user_id)).size,
                    todayBookings: bookings.filter((b: { start_at: string }) => b.start_at.startsWith(today)).length,
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            }
            setLoading(false)
        }

        fetchData()
    }, [])

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
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground">Resumen y gestión del sistema</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <Button variant="ghost" size="sm" className="mt-2 text-yellow-500">
                                Ver pendientes <ArrowRight className="w-4 h-4 ml-1" />
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
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pendientes Pago
                        </CardTitle>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingPayment}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Reservas Hoy
                        </CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayBookings}</div>
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
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
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
                        <CardTitle>Información del Sistema</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>• 3 canchas configuradas</p>
                        <p>• Horario: 09:00 - 22:00</p>
                        <p>• Duración por bloque: 60 minutos</p>
                        <p>• Zona horaria: America/Santiago</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
