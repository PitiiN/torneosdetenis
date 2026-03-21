import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ensureAdminUser } from '@/lib/auth/admin'
import { adminBookingFilterSchema } from '@/lib/validations/admin'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Verify Admin Access
        try {
            await ensureAdminUser(supabase)
        } catch (error) {
            return NextResponse.json(
                { error: 'Unauthorized or Forbidden' },
                { status: 403 }
            )
        }

        // 2. Validate Inputs
        const { searchParams } = new URL(request.url)
        const rawParams = {
            status: searchParams.get('status') || undefined,
            fieldId: searchParams.get('fieldId') || undefined,
            userId: searchParams.get('userId') || undefined,
            from: searchParams.get('from') || undefined,
            to: searchParams.get('to') || undefined,
            summary: searchParams.get('summary') || undefined,
        }

        const validationResult = adminBookingFilterSchema.safeParse(rawParams)

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid parameters', details: validationResult.error.format() },
                { status: 400 }
            )
        }

        const filters = validationResult.data

        // 3. Update Status Logic (Map Admin Status to DB Status if needed)
        // Note: Currently assumes filters.status matches DB status.
        // TODO: In Phase C, we will strict mapping here.

        // 4. Fetch Data
        const adminClient = await createAdminClient()
        let query = adminClient.from('bookings').select(
            filters.summary
                ? 'id, status, start_at, user_id, created_at'
                : '*, field:fields(*), user:profiles(id, full_name, phone)'
        ).order('created_at', { ascending: false })

        if (filters.status) query = query.eq('status', filters.status)
        if (filters.fieldId) query = query.eq('field_id', filters.fieldId)
        if (filters.userId) query = query.eq('user_id', filters.userId)
        if (filters.from) query = query.gte('start_at', filters.from)
        if (filters.to) query = query.lte('start_at', filters.to)

        const { data: bookings, error } = await query

        console.log(`[API Bookings] Fetching for field ${filters.fieldId} range ${filters.from} - ${filters.to}`)
        console.log(`[API Bookings] Found ${bookings?.length} rows`)

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({ bookings })
    } catch (error) {
        console.error('Admin bookings API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
