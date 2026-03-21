const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wlzqcrrkmaoqjqpkmigh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenFjcnJrbWFvcWpxcGttaWdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTc4NCwiZXhwIjoyMDg1ODExNzg0fQ.keR_1hSSn6pCckYcZhOwE3BowsA09caClf78mjRdhvw';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function getPublicStatus(status) {
    if (status === 'PENDIENTE_PAGO' || status === 'EN_VERIFICACION') return 'PENDIENTE';
    if (status === 'PAGADA') return 'PAGADA';
    if (status === 'CANCELADA' || status === 'RECHAZADA' || status === 'EXPIRADA') return 'CANCELADA';
    if (status === 'BLOQUEADA') return 'BLOQUEADA';
    return 'PENDIENTE';
}

async function run() {
    console.log('--- STARTING STATUS FLOW VERIFICATION ---');

    // 1. Setup Data
    console.log('Fetching setup data...');
    const { data: fields } = await supabase.from('fields').select('id').eq('is_active', true).limit(1);
    const { data: users } = await supabase.from('profiles').select('id').limit(1);

    if (!fields?.length || !users?.length) {
        console.error('Failed to get setup data (fields/users)');
        return;
    }

    const fieldId = fields[0].id;
    const userId = users[0].id;
    console.log(`Using Field: ${fieldId}, User: ${userId}`);

    // Cleanup previous test data
    await supabase.from('bookings').delete().eq('created_source', 'test_script');

    // 2. Test Cases
    const now = new Date();
    const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Case A: PENDIENTE_PAGO (Active)
    console.log('\n[Case A] Testing Active PENDIENTE_PAGO...');
    const startA = futureTime.toISOString();
    const endA = new Date(futureTime.getTime() + 60 * 60 * 1000).toISOString();

    const { data: bookingA, error: errA } = await supabase.from('bookings').insert({
        field_id: fieldId,
        user_id: userId,
        start_at: startA,
        end_at: endA,
        status: 'PENDIENTE_PAGO',
        price_total_cents: 10000,
        duration_minutes: 60,
        created_source: 'test_script'
    }).select().single();

    if (errA) console.error('Error creating A:', errA);
    else {
        const publicStatus = getPublicStatus(bookingA.status);
        console.log(`Booking ID: ${bookingA.id}`);
        console.log(`Internal Status: ${bookingA.status}`);
        console.log(`Public Status: ${publicStatus}`);
        if (publicStatus === 'PENDIENTE') console.log('✅ Status Map Passed');
        else console.error('❌ Status Map Failed');

        // Check Availability (Should be BLOCKED because it's active)
        const { data: availA } = await supabase
            .from('bookings')
            .select('id')
            .eq('field_id', fieldId)
            .eq('start_at', startA)
            .not('status', 'in', '("CANCELADA","EXPIRADA")'); // Only active bookings

        if (availA && availA.length > 0) console.log('✅ Availability Blocked (Correct)');
        else console.error('❌ Availability NOT Blocked (Incorrect)');
    }

    // Case B: BLOQUEADA
    console.log('\n[Case B] Testing BLOQUEADA...');
    const startB = new Date(futureTime.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const endB = new Date(futureTime.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const { data: bookingB, error: errB } = await supabase.from('bookings').insert({
        field_id: fieldId,
        user_id: userId,
        start_at: startB,
        end_at: endB,
        status: 'BLOQUEADA',
        price_total_cents: 0,
        duration_minutes: 60,
        created_source: 'test_script'
    }).select().single();

    if (errB) console.error('Error creating B:', errB);
    else {
        const publicStatus = getPublicStatus(bookingB.status);
        console.log(`Internal Status: ${bookingB.status}`);
        if (bookingB.status === 'BLOQUEADA') console.log('✅ Status Persisted');

        // Check Availability (Should be BLOCKED)
        const { data: availB } = await supabase
            .from('bookings')
            .select('id')
            .eq('id', bookingB.id)
            .not('status', 'in', '("CANCELADA","EXPIRADA")');

        if (availB && availB.length > 0) console.log('✅ Availability Blocked (Correct)');
        else console.error('❌ Availability NOT Blocked (Incorrect)');
    }

    // Case C: Expiration Logic
    console.log('\n[Case C] Testing Expiration Logic...');
    // Create an "Old" pending booking
    const startC = new Date(futureTime.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const endC = new Date(futureTime.getTime() + 5 * 60 * 60 * 1000).toISOString();
    const oldCreated = new Date(now.getTime() - 15 * 60 * 1000).toISOString(); // 15 mins ago

    const { data: bookingC, error: errC } = await supabase.from('bookings').insert({
        field_id: fieldId,
        user_id: userId,
        start_at: startC,
        end_at: endC,
        status: 'PENDIENTE_PAGO',
        price_total_cents: 10000,
        duration_minutes: 60,
        created_source: 'test_script',
        created_at: oldCreated // Force old creation time
    }).select().single();

    if (errC) console.error('Error creating C:', errC);
    else {
        console.log(`Booking C Created (15m old)`);

        // Verify manual expiration check
        const isExpired = (new Date() - new Date(bookingC.created_at)) > 10 * 60 * 1000;
        console.log(`Is Expired Calculation: ${isExpired}`);
        if (isExpired) console.log('✅ Expiration Time Logic Correct');
        else console.error('❌ Expiration Time Logic Failed');

        // Verify Availability Query Logic (simulate api/availability/week)
        // logic: filter out bookings where status=PENDIENTE_PAGO AND now - created_at > 10m

        // Simulating the check by fetching ALL overlapping bookings and filtering in JS as the API does
        const { data: intersections } = await supabase
            .from('bookings')
            .select('id, status, created_at')
            .eq('id', bookingC.id)
            .not('status', 'in', '("CANCELADA","EXPIRADA")'); // Raw fetch

        const conflicts = intersections?.filter(b => {
            if (b.status !== 'PENDIENTE_PAGO') return true; // Real conflict
            const created = new Date(b.created_at).getTime();
            const timeDiff = Date.now() - created;
            if (timeDiff > 10 * 60 * 1000) return false; // Expired, so NO conflict (available)
            return true; // Still active conflict
        });

        if (conflicts && conflicts.length === 0) console.log('✅ Slot is Available (Expired Hold ignored)');
        else console.error('❌ Slot is NOT Available (Expired Hold still blocking)');
    }

    // Cleanup
    console.log('\nCleaning up...');
    await supabase.from('bookings').delete().eq('created_source', 'test_script');
    console.log('Done.');
}

run();
