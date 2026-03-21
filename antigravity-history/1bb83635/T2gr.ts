import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { addMinutes, parseISO } from "https://esm.sh/date-fns@4"
import { formatInTimeZone } from "https://esm.sh/date-fns-tz@3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIMEZONE = 'America/Santiago'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Get current user
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { fieldId, startAt, durationMinutes } = await req.json()

        // 2. Normalize Dates
        const startDate = parseISO(startAt)
        const endDate = addMinutes(startDate, durationMinutes)

        const normalizedStartAt = formatInTimeZone(startDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
        const calculatedEndAt = formatInTimeZone(endDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")

        // 3. Initialize Admin Client for cleanup/overlap check (to see all bookings)
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 4. Check for overlaps and expired holds
        const { data: overlaps } = await adminClient
            .from('bookings')
            .select('id, status, created_at')
            .eq('field_id', fieldId)
            .lt('start_at', calculatedEndAt)
            .gt('end_at', normalizedStartAt)
            .not('status', 'in', '("CANCELADA")')

        if (overlaps && overlaps.length > 0) {
            const now = Date.now()
            const canCleanup = overlaps.every(b => {
                if (b.status !== 'PENDIENTE_PAGO') return false
                const created = new Date(b.created_at).getTime()
                return (now - created > 10 * 60 * 1000) // 10 minutes
            })

            if (canCleanup) {
                const idsToDelete = overlaps.map(b => b.id)
                await adminClient.from('bookings').delete().in('id', idsToDelete)
            } else {
                return new Response(JSON.stringify({ error: 'Este horario ya está reservado. Por favor selecciona otro.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 409,
                })
            }
        }

        // 5. Create Booking
        const { data: booking, error: bookingError } = await adminClient
            .from('bookings')
            .insert({
                user_id: user.id,
                field_id: fieldId,
                start_at: normalizedStartAt,
                end_at: calculatedEndAt,
                duration_minutes: durationMinutes,
                status: 'PENDIENTE_PAGO',
                created_source: 'mobile-app',
            })
            .select()
            .single()

        if (bookingError) throw bookingError

        return new Response(JSON.stringify({ success: true, booking }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
