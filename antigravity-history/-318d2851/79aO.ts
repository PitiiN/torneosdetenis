import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '../src/lib/supabase/server'

async function debugBulkPayment() {
    const adminClient = await createAdminClient()

    console.log('Fetching a pending booking...')
    // Try to find one with a user first
    let { data: bookings, error: fetchError } = await adminClient
        .from('bookings')
        .select('id, status, user_id, price_total_cents')
        .eq('status', 'PENDIENTE_PAGO')
        .not('user_id', 'is', null)
        .limit(1)

    if (fetchError || !bookings || bookings.length === 0) {
        console.log('No pending bookings with user found. Trying ANY booking to test SELECT...')
        const { data: anyBookings } = await adminClient
            .from('bookings')
            .select('id, status, user_id, price_total_cents')
            .limit(1)

        if (!anyBookings || anyBookings.length === 0) {
            console.error('No bookings found at all.')
            return
        }
        bookings = anyBookings
    }

    const booking = bookings![0]
    console.log('Found booking:', booking)

    console.log('Attempting to update status to PAGADA with complex SELECT...')

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (adminClient
            .from('bookings') as any)
            .update({
                status: 'PAGADA',
                status_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)
            .select(`
                id,
                status,
                field:fields(name),
                user:profiles(full_name)
            `)

        if (error) {
            console.error('Update/Select failed:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
        } else {
            console.log('Update successful:', JSON.stringify(data, null, 2))
        }

    } catch (e) {
        console.error('Exception during update:', e)
    }
}

debugBulkPayment()
