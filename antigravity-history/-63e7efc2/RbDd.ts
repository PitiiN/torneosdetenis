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
        const month = searchParams.get('month')

        // Calculate date range if month is provided
        let startDate: Date | null = null
        let endDate: Date | null = null

        if (month && month !== 'all') {
            const [year, monthIndex] = month.split('-').map(Number)
            startDate = new Date(year, monthIndex - 1, 1)
            endDate = new Date(year, monthIndex, 1)
        }

        // Use admin client
        const adminClient = await createAdminClient()

        // Get ALL active bookings (not cancelled/expired) with user info
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

        // Filtering by user_id not null was removing anonymous bookings.
        // We now include them.

        if (fieldId && fieldId !== 'all') {
            query = query.eq('field_id', fieldId)
        }

        if (startDate && endDate) {
            query = query
                .gte('start_at', startDate.toISOString())
                .lt('start_at', endDate.toISOString())
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
            user_id: string | null
            status: string
            start_at: string
            price_total_cents: number
            field: { name: string } | null
            user: { id: string; full_name: string | null; email: string | null; phone: string | null } | null
        }

        const typedBookings = allBookings as BookingRow[]

        // Group by user
        const userMap = new Map<string, UserBookingSummary>()

        // Special ID for anonymous users
        const ANONYMOUS_ID = 'anonymous'

        for (const booking of typedBookings) {
            // Determine user key and details
            const userId = booking.user_id || ANONYMOUS_ID
            const userFullName = booking.user?.full_name || (userId === ANONYMOUS_ID ? 'Usuario Anónimo / Admin' : 'Sin Nombre')
            const userEmail = booking.user?.email || (userId === ANONYMOUS_ID ? '-' : null)
            const userPhone = booking.user?.phone || null

            const existingUser = userMap.get(userId)
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
                userMap.set(userId, {
                    userId: userId,
                    fullName: userFullName,
                    email: userEmail,
                    phone: userPhone,
                    bookings: [bookingInfo],
                    totalDebtCents: isUnpaid ? bookingInfo.priceTotalCents : 0,
                    totalPaidCents: isPaid ? bookingInfo.priceTotalCents : 0,
                    hasDebt: isUnpaid
                })
            }
        }

        // Convert to array and sort
        const users = Array.from(userMap.values())
            .sort((a, b) => {
                // Anonymous user at the bottom or top? Let's keep existing logic: debt first.
                // But specifically for Anon, maybe we want them visible.
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
