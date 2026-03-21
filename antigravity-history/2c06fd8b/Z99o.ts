import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { addHours, parseISO } from 'date-fns'

// Schema for recurring booking
const recurringBookingSchema = z.object({
    fieldId: z.string().uuid(),
    userId: z.string().uuid().nullable().optional(),
    dates: z.array(z.string()).min(1, 'Se requiere al menos una fecha'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:mm)'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:mm)'),
    status: z.enum([
        'PENDIENTE_PAGO',
        'EN_VERIFICACION',
        'PAGADA',
        'BLOQUEADA'
    ]).default('PAGADA'),
    priceTotalCents: z.number().min(0).optional(),
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
        const validation = recurringBookingSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { fieldId, userId, dates, startTime, endTime, status, priceTotalCents } = validation.data

        // Calculate duration
        const [startHour, startMin] = startTime.split(':').map(Number)
        const [endHour, endMin] = endTime.split(':').map(Number)
        const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)

        if (durationMinutes <= 0) {
            return NextResponse.json(
                { error: 'La hora de fin debe ser posterior a la hora de inicio' },
                { status: 400 }
            )
        }

        // Use admin client
        const adminClient = await createAdminClient()

        // Check for conflicts
        const conflicts: string[] = []
        const bookingsToCreate: Array<{
            field_id: string
            user_id: string | null
            start_at: string
            end_at: string
            duration_minutes: number
            status: string
            price_total_cents: number
            created_source: string
            status_updated_by: string
            status_updated_at: string
        }> = []

        for (const dateStr of dates) {
            const startAt = `${dateStr}T${startTime}:00-03:00` // Chile timezone
            const endAt = `${dateStr}T${endTime}:00-03:00`

            // Check for existing bookings in this slot
            const { data: existing } = await adminClient
                .from('bookings')
                .select('id')
                .eq('field_id', fieldId)
                .gte('start_at', startAt)
                .lt('start_at', endAt)
                .not('status', 'in', '("CANCELADA","RECHAZADA","EXPIRADA")')

            if (existing && existing.length > 0) {
                conflicts.push(dateStr)
            } else {
                bookingsToCreate.push({
                    field_id: fieldId,
                    user_id: userId || null,
                    start_at: startAt,
                    end_at: endAt,
                    duration_minutes: durationMinutes,
                    status: status,
                    price_total_cents: priceTotalCents || 0,
                    created_source: 'admin',
                    status_updated_by: user.id,
                    status_updated_at: new Date().toISOString(),
                })
            }
        }

        if (bookingsToCreate.length === 0) {
            return NextResponse.json({
                success: true,
                createdCount: 0,
                bookings: [],
                conflicts,
                message: 'Todas las fechas tienen conflictos con reservas existentes'
            })
        }

        // Create bookings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: createdBookings, error: createError } = await (adminClient
            .from('bookings') as any)
            .insert(bookingsToCreate)
            .select(`
                *,
                field:fields(name),
                user:profiles(full_name)
            `)

        if (createError) {
            console.error('Create recurring bookings error:', createError)
            return NextResponse.json(
                { error: 'Error al crear las reservas' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            createdCount: createdBookings?.length || 0,
            bookings: createdBookings,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
            message: conflicts.length > 0
                ? `${createdBookings?.length} reservas creadas. ${conflicts.length} fechas omitidas por conflictos.`
                : `${createdBookings?.length} reservas creadas exitosamente`,
        })
    } catch (error) {
        console.error('Recurring booking API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
