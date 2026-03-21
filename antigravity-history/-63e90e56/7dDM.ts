import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { subDays, format } from 'date-fns'

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

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if user is admin
        const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const typedRole = userRole as { role: string } | null
        if (!typedRole || typedRole.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        const { searchParams } = new URL(request.url)
        const period = searchParams.get('period') || '30d'

        // Calculate date range
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30
        const startDate = subDays(new Date(), days)

        // Use admin client
        const adminClient = await createAdminClient()

        // Get all fields
        const { data: fields } = await adminClient
            .from('fields')
            .select('id, name')
            .eq('is_active', true)

        if (!fields) {
            return NextResponse.json({ stats: [], summary: {} })
        }

        // Get all bookings in the period
        const { data: bookings } = await adminClient
            .from('bookings')
            .select('id, field_id, status, price_total_cents, start_at')
            .gte('start_at', startDate.toISOString())
            .not('status', 'in', '("CANCELADA","RECHAZADA","EXPIRADA")')

        const typedBookings = bookings as Array<{
            id: string
            field_id: string
            status: string
            price_total_cents: number
            start_at: string
        }> | null

        // Calculate stats per field
        const fieldStats: FieldStats[] = fields.map(field => {
            const fieldBookings = typedBookings?.filter(b => b.field_id === field.id) || []

            const paidBookings = fieldBookings.filter(b => b.status === 'PAGADA')
            const pendingPayment = fieldBookings.filter(b => b.status === 'PENDIENTE_PAGO')
            const pendingVerification = fieldBookings.filter(b => b.status === 'EN_VERIFICACION')
            const unpaidBookings = [...pendingPayment, ...pendingVerification]

            return {
                fieldId: field.id,
                fieldName: field.name,
                totalBookings: fieldBookings.length,
                paidBookings: paidBookings.length,
                unpaidBookings: unpaidBookings.length,
                pendingPayment: pendingPayment.length,
                pendingVerification: pendingVerification.length,
                totalRevenueCents: paidBookings.reduce((sum, b) => sum + (b.price_total_cents || 0), 0),
                pendingRevenueCents: unpaidBookings.reduce((sum, b) => sum + (b.price_total_cents || 0), 0),
            }
        })

        // Calculate summary
        const summary = {
            totalBookings: fieldStats.reduce((sum, f) => sum + f.totalBookings, 0),
            totalPaid: fieldStats.reduce((sum, f) => sum + f.paidBookings, 0),
            totalUnpaid: fieldStats.reduce((sum, f) => sum + f.unpaidBookings, 0),
            totalRevenueCents: fieldStats.reduce((sum, f) => sum + f.totalRevenueCents, 0),
            pendingRevenueCents: fieldStats.reduce((sum, f) => sum + f.pendingRevenueCents, 0),
            period,
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
        }

        return NextResponse.json({
            stats: fieldStats,
            summary,
        })
    } catch (error) {
        console.error('Financial stats API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
