import { addMinutes, format, parseISO } from 'date-fns'

// ... (keep usage of NextRequest, createClient, z)

// ... inside POST
const { fieldId, startAt, durationMinutes } = validation.data

// Force calculation of endAt on server to ensure duration consistency
// Parse as ISO (local time agnostic) -> Add Duration -> Format back to ISO without TZ
// This ensures if Start is 18:30, End is ALWAYS 19:30 regardless of client payload
const startDate = parseISO(startAt)
const endDate = addMinutes(startDate, durationMinutes)
const calculatedEndAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss")

// Check field exists ...

// ... inside insert
const { data: booking, error: bookingError } = await (supabase
    .from('bookings') as any)
    .insert({
        user_id: user.id,
        field_id: fieldId,
        start_at: startAt,
        end_at: calculatedEndAt, // Use calculated time
        duration_minutes: durationMinutes,
        status: 'PENDIENTE_PAGO',
        created_source: 'portal',
    })
    .select()
    .single()

if (bookingError) {
    // Check if it's an overlap constraint violation
    if (bookingError.code === '23P01' || bookingError.message.includes('bookings_no_overlap')) {
        return NextResponse.json(
            { error: 'Este horario ya está reservado. Por favor selecciona otro.' },
            { status: 409 }
        )
    }
    console.error('Booking error:', bookingError)
    return NextResponse.json(
        { error: 'Error al crear la reserva' },
        { status: 500 }
    )
}

return NextResponse.json({
    success: true,
    booking,
    message: 'Reserva creada exitosamente',
})
    } catch (error) {
    console.error('Bookings API error:', error)
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

        // Auto-expire old pending bookings (Lazy expiration)
        // If booking is PENDIENTE_PAGO and created > 10 mins ago -> EXPIRADA
        try {
            const expirationTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
            const adminSupabase = await createAdminClient()
            await (adminSupabase
                .from('bookings') as any)
                .update({ status: 'EXPIRADA' })
                .eq('status', 'PENDIENTE_PAGO')
                .lt('created_at', expirationTime)
        } catch (expireError) {
            console.error('Error auto-expiring bookings:', expireError)
            // Continue even if expiration fails
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const fieldId = searchParams.get('fieldId')

        let query = supabase
            .from('bookings')
            .select('*, field:fields(*)')
            .eq('user_id', user.id)
            .order('start_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        if (fieldId) {
            query = query.eq('field_id', fieldId)
        }

        const { data: bookings, error } = await query

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json(
                { error: 'Error al obtener reservas' },
                { status: 500 }
            )
        }

        return NextResponse.json({ bookings })
    } catch (error) {
        console.error('Bookings API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
