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
                : '*, field:fields(*)' // Removed broken user:profiles join
        ).order('created_at', { ascending: false })

        if (filters.status) query = query.eq('status', filters.status)
        if (filters.fieldId) query = query.eq('field_id', filters.fieldId)
        if (filters.userId) query = query.eq('user_id', filters.userId)
        if (filters.from) {
            console.log('[API Debug] Filtering from:', filters.from)
            query = query.gte('start_at', filters.from)
        }
        if (filters.to) {
            console.log('[API Debug] Filtering to:', filters.to)
            query = query.lte('start_at', filters.to)
        }

        const { data: bookingsData, error } = await query

        console.log(`[API Bookings] Fetching for field ${filters.fieldId} range ${filters.from} - ${filters.to}`)
        console.log(`[API Bookings] Found ${bookingsData?.length} rows`)

        if (error) {
            console.error('Error fetching bookings:', error)
            const errorDetails = {
                message: (error as any).message,
                code: (error as any).code,
                details: (error as any).details,
                hint: (error as any).hint
            }
            return NextResponse.json({ error: 'Database error', details: errorDetails }, { status: 500 })
        }

        // Manual Join for Profiles
        let bookings = bookingsData || []
        // If we need detailed info (not summary), fetch profiles manually
        if (!filters.summary && bookings.length > 0) {
            const userIds = Array.from(new Set(bookings.map((b: any) => b.user_id).filter(Boolean)))

            if (userIds.length > 0) {
                const { data: profiles, error: profilesError } = await adminClient
                    .from('profiles')
                    .select('id, full_name, phone')
                    .in('id', userIds)

                if (profiles && !profilesError) {
                    const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
                    bookings = bookings.map((b: any) => ({
                        ...b,
                        user: b.user_id ? profileMap.get(b.user_id) : null
                    }))
                } else {
                    console.warn('[API Bookings] Profile fetch error:', profilesError)
                }
            }
        }

        return NextResponse.json({ bookings })
    } catch (error) {
        console.error('Admin bookings API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
