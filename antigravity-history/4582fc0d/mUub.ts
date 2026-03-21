import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createBlockSchema = z.object({
    fieldId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
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

        const body = await request.json()

        // Validate input
        const validation = createBlockSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { fieldId, startAt, endAt, reason } = validation.data

        const adminClient = await createAdminClient()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: block, error: blockError } = await (adminClient
            .from('blocks') as any)
            .insert({
                field_id: fieldId,
                start_at: startAt,
                end_at: endAt,
                reason: reason || null,
                created_by: user.id,
            })
            .select()
            .single()

        if (blockError) {
            console.error('Block error:', blockError)
            return NextResponse.json(
                { error: 'Error al crear bloqueo' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            block,
            message: 'Bloqueo creado exitosamente',
        })
    } catch (error) {
        console.error('Blocks API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
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

        const typedRole2 = userRole as { role: string } | null
        if (!typedRole2 || typedRole2.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        const { searchParams } = new URL(request.url)
        const fieldId = searchParams.get('fieldId')

        const adminClient = await createAdminClient()

        let query = adminClient
            .from('blocks')
            .select('*, field:fields(name)')
            .order('start_at', { ascending: false })

        if (fieldId) {
            query = query.eq('field_id', fieldId)
        }

        const { data: blocks, error } = await query

        if (error) {
            console.error('Error fetching blocks:', error)
            return NextResponse.json(
                { error: 'Error al obtener bloqueos' },
                { status: 500 }
            )
        }

        return NextResponse.json({ blocks })
    } catch (error) {
        console.error('Blocks API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
