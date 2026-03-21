const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = 'https://wlzqcrrkmaoqjqpkmigh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenFjcnJrbWFvcWpxcGttaWdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTc4NCwiZXhwIjoyMDg1ODExNzg0fQ.keR_1hSSn6pCckYcZhOwE3BowsA09caClf78mjRdhvw';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log('--- STARTING DEBTORS VERIFICATION ---');

    // 1. Get Fields
    const { data: fields } = await supabase.from('fields').select('id, name').limit(1);
    if (!fields || fields.length === 0) {
        console.error('No fields found');
        return;
    }
    const testField = fields[0];
    console.log(`Test Field: ${testField.name} (${testField.id})`);

    // 2. Query Debtors (Simulating API logic)
    console.log('\n--- Testing Debtors Query ---');
    const { data: debtors } = await supabase
        .from('bookings')
        .select(`
            id,
            user_id,
            status,
            field_id
        `)
        .in('status', ['PENDIENTE_PAGO', 'EN_VERIFICACION'])
        .eq('field_id', testField.id)
        .not('user_id', 'is', null);

    console.log(`Found ${debtors?.length || 0} unpaid bookings for field ${testField.name}`);

    if (debtors?.some(d => d.field_id !== testField.id)) {
        console.error('❌ Field Filter FAILED: Found bookings for other fields');
    } else {
        console.log('✅ Field Filter PASSED');
    }

    if (!debtors || debtors.length === 0) {
        console.log('No debtors found to test user history. Create a pending booking first.');
        return;
    }

    const testUserId = debtors[0].user_id;
    console.log(`\n--- Testing User History Query for User: ${testUserId} ---`);

    // 3. Query User History (Simulating API logic)
    const { data: userBookings } = await supabase
        .from('bookings')
        .select('id, status, field_id, user_id')
        .eq('user_id', testUserId)
        .eq('field_id', testField.id);

    console.log(`Found ${userBookings?.length || 0} bookings for user in this field`);

    if (userBookings?.some(b => b.user_id !== testUserId)) {
        console.error('❌ User Filter FAILED');
    } else if (userBookings?.some(b => b.field_id !== testField.id)) {
        console.error('❌ Field Filter in User History FAILED');
    } else {
        console.log('✅ User History Filters PASSED');
    }

    console.log('--- DONE ---');
}

run();
