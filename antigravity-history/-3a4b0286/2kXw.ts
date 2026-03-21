import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '../src/lib/supabase/server'

async function deleteAllBookings() {
    const adminClient = await createAdminClient()

    console.log('⚠️  ATENCIÓN: Se eliminarán TODAS las reservas (pasadas, presentes y futuras)...')

    // First count them
    const { count, error: countError } = await adminClient
        .from('bookings')
        .select('*', { count: 'exact', head: true })

    if (countError) {
        console.error('Error contando reservas:', countError)
        return
    }

    console.log(`Se encontraron ${count} reservas para eliminar.`)

    if (count === 0) {
        console.log('No hay reservas que eliminar.')
        return
    }

    // Delete in batches or all at once? Supabase/Postgres can handle 'neq 0' trick or just no filter?
    // Delete needs a filter usually to prevent accidental wipe, but we want accidental wipe here.
    // We can use .neq('id', '00000000-0000-0000-0000-000000000000') or similar if needed, 
    // but .gt('created_at', '1970-01-01') is safer.

    const { error: deleteError } = await adminClient
        .from('bookings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Efficient "delete all" filter

    if (deleteError) {
        console.error('Error eliminando reservas:', deleteError)
    } else {
        console.log('✅ Todas las reservas han sido eliminadas exitosamente.')
    }
}

deleteAllBookings()
