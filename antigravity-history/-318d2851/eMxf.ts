import { createAdminClient } from '../src/lib/supabase/server'

async function debugBulkPayment() {
    const adminClient = await createAdminClient()

    console.log('Fetching a pending booking...')
    const { data: bookings, error: fetchError } = await adminClient
        .from('bookings')
        .select('id, status, user_id, price_total')
        .eq('status', 'PENDIENTE_PAGO')
        .limit(1)

    if (fetchError || !bookings || bookings.length === 0) {
        console.error('No pending bookings found or error fetching:', fetchError)
        return
    }

    const booking = bookings[0]
    console.log('Found booking:', booking)

    console.log('Attempting to update status to PAGADA...')

    try {
        const { data, error } = await adminClient
            .from('bookings')
            .update({
                status: 'PAGADA',
                status_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)
            .select()

        if (error) {
            console.error('Update failed:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
        } else {
            console.log('Update successful:', data)
        }

    } catch (e) {
        console.error('Exception during update:', e)
    }
}

debugBulkPayment()
