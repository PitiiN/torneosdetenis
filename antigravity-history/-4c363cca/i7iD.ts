import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface DebtorInfo {
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

        // Use admin client
        const adminClient = await createAdminClient()

        // Get unpaid bookings with user info
        const { data: unpaidBookings, error } = await adminClient
            .from('bookings')
            .select(`
                id,
                user_id,
                status,
                start_at,
                price_total_cents,
                field:fields(name),
                user:profiles(id, full_name, email, phone)
            `)
            .in('status', ['PENDIENTE_PAGO', 'EN_VERIFICACION'])
            .not('user_id', 'is', null)
            .order('start_at', { ascending: false })

        if (error) {
            console.error('Error fetching debtors:', error)
            return NextResponse.json(
                { error: 'Error al obtener lista de morosos' },
                { status: 500 }
            )
        }

        // Type the response
        interface BookingRow {
            id: string
            user_id: string
            status: string
            start_at: string
            price_total_cents: number
            field: { name: string } | null
            user: { id: string; full_name: string | null; email: string | null; phone: string | null } | null
        }

        const typedBookings = unpaidBookings as BookingRow[]

        // Group by user
        const debtorMap = new Map<string, DebtorInfo>()

        for (const booking of typedBookings) {
            if (!booking.user_id || !booking.user) continue

            const existingDebtor = debtorMap.get(booking.user_id)

            const bookingInfo = {
                id: booking.id,
                fieldName: booking.field?.name || 'Cancha',
                startAt: booking.start_at,
                status: booking.status,
                priceTotalCents: booking.price_total_cents || 0,
            }

            if (existingDebtor) {
                existingDebtor.unpaidBookings.push(bookingInfo)
                existingDebtor.totalDebtCents += bookingInfo.priceTotalCents
            } else {
                debtorMap.set(booking.user_id, {
                    userId: booking.user_id,
                    fullName: booking.user.full_name || 'Sin nombre',
                    email: booking.user.email,
                    phone: booking.user.phone,
                    unpaidBookings: [bookingInfo],
                    totalDebtCents: bookingInfo.priceTotalCents,
                })
            }
        }

        // Convert to array and sort by total debt (descending)
        const debtors = Array.from(debtorMap.values())
            .sort((a, b) => b.totalDebtCents - a.totalDebtCents)

        return NextResponse.json({
            debtors,
            totalDebtors: debtors.length,
            totalDebtCents: debtors.reduce((sum, d) => sum + d.totalDebtCents, 0),
        })
    } catch (error) {
        console.error('Debtors API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
