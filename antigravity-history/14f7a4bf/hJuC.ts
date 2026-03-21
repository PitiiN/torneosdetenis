
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('Diagnosing email issue...');

    // 1. Find the booking
    // Using a range for Feb 9th 2026
    const startOfDay = '2026-02-09T00:00:00-03:00';
    const endOfDay = '2026-02-09T23:59:59-03:00';

    const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('*, field:fields(*)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .ilike('field.name', '%Huelén 5%'); // Searching by field name via join might work if clear, but safer to filter in code if complex

    // Manual filter for field name if join filter fails or returns too many
    // Actually, let's just fetch all bookings for that day and filter in JS to be safe and see what we get.
    const { data: allBookings, error: allBookingError } = await supabase
        .from('bookings')
        .select(`
            *,
            field:fields(*)
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay);

    if (allBookingError) {
        console.error('Error fetching bookings:', allBookingError);
        return;
    }

    const booking = allBookings?.find(b => b.field?.name.includes('Huelén 5'));

    if (!booking) {
        console.log('No booking found for Huelén 5 on Feb 9th.');
        console.log('Bookings found on that day:', allBookings?.map(b => `${b.field?.name} - ${b.start_at}`));
        return;
    }

    console.log('Found booking:', {
        id: booking.id,
        user_id: booking.user_id,
        status: booking.status,
        field_name: booking.field?.name
    });

    if (!booking.user_id) {
        console.log('Booking has no user_id.');
        return;
    }

    // 2. Fetch profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', booking.user_id)
        .single();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
    } else {
        console.log('Found profile:', profile);
    }

    // 3. Check auth users (admin only)
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(booking.user_id);
    if (authError) {
        console.error('Error fetching auth user:', authError);
    } else {
        console.log('Found ID in Auth Users:', { id: user?.id, email: user?.email });
    }
}

main();
