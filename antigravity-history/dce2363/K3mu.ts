import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
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

        if (!userRole || userRole.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        const adminClient = await createAdminClient()

        const { error: deleteError } = await adminClient
            .from('field_blocks')
            .delete()
            .eq('id', id)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json(
                { error: 'Error al eliminar bloqueo' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Bloqueo eliminado exitosamente',
        })
    } catch (error) {
        console.error('Block delete API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
