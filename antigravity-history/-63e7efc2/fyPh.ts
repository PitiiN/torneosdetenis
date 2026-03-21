import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface UserBookingSummary {
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    bookings: Array<{
        id: string
        fieldName: string
        startAt: string
        status: string
        priceTotalCents: number
    }>
    totalDebtCents: number
    totalPaidCents: number
    hasDebt: boolean
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
        const fieldId = searchParams.get('fieldId')

        // Use admin client
        const adminClient = await createAdminClient()

        // Get ALL active bookings (not cancelled) with user info
        let query = adminClient
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
            .neq('status', 'CANCELADA') // Exclude cancelled
            .neq('status', 'EXPIRADA')  // Exclude expired
            .not('user_id', 'is', null)

        if (fieldId && fieldId !== 'all') {
            query = query.eq('field_id', fieldId)
        }

        const { data: allBookings, error } = await query.order('start_at', { ascending: false })

        if (error) {
            console.error('Error fetching field users:', error)
            return NextResponse.json(
                { error: 'Error al obtener lista de usuarios' },
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

        const typedBookings = allBookings as BookingRow[]

        // Group by user
        const userMap = new Map<string, UserBookingSummary>()

        for (const booking of typedBookings) {
            if (!booking.user_id || !booking.user) continue

            const existingUser = userMap.get(booking.user_id)
            const isUnpaid = booking.status === 'PENDIENTE_PAGO' || booking.status === 'EN_VERIFICACION'
            const isPaid = booking.status === 'PAGADA'

            const bookingInfo = {
                id: booking.id,
                fieldName: booking.field?.name || 'Cancha',
                startAt: booking.start_at,
                status: booking.status,
                priceTotalCents: booking.price_total_cents || 0,
            }

            if (existingUser) {
                existingUser.bookings.push(bookingInfo)
                if (isUnpaid) {
                    existingUser.totalDebtCents += bookingInfo.priceTotalCents
                    existingUser.hasDebt = true
                }
                if (isPaid) {
                    existingUser.totalPaidCents += bookingInfo.priceTotalCents
                }
            } else {
                userMap.set(booking.user_id, {
                    userId: booking.user_id,
                    fullName: booking.user.full_name || 'Sin nombre',
                    email: booking.user.email,
                    phone: booking.user.phone,
                    bookings: [bookingInfo],
                    totalDebtCents: isUnpaid ? bookingInfo.priceTotalCents : 0,
                    totalPaidCents: isPaid ? bookingInfo.priceTotalCents : 0,
                    hasDebt: isUnpaid
                })
            }
        }

        // Convert to array and sort
        // Sort priority: Has debt > Total Debt > Most recent booking
        const users = Array.from(userMap.values())
            .sort((a, b) => {
                if (a.hasDebt && !b.hasDebt) return -1
                if (!a.hasDebt && b.hasDebt) return 1
                return b.totalDebtCents - a.totalDebtCents
            })

        return NextResponse.json({
            users,
            totalUsers: users.length,
            totalDebtCents: users.reduce((sum, u) => sum + u.totalDebtCents, 0),
        })
    } catch (error) {
        console.error('Field users API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
