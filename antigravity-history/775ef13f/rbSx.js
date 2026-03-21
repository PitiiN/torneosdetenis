const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = 'https://wlzqcrrkmaoqjqpkmigh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenFjcnJrbWFvcWpxcGttaWdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTc4NCwiZXhwIjoyMDg1ODExNzg0fQ.keR_1hSSn6pCckYcZhOwE3BowsA09caClf78mjRdhvw';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log('--- STARTING FINANCIAL FILTER VERIFICATION ---');

    // 1. Get Fields
    const { data: fields } = await supabase.from('fields').select('id, name').limit(2);
    if (!fields || fields.length === 0) {
        console.error('No fields found');
        return;
    }
    const testField = fields[0];
    console.log(`Test Field: ${testField.name} (${testField.id})`);

    // 2. Define Filters
    const testMonth = '2026-02'; // Assuming we are in Feb 2026 or near it per context
    const [year, monthIndex] = testMonth.split('-').map(Number);

    // Logic from API
    const startDate = new Date(year, monthIndex - 1, 1);
    const endDate = new Date(year, monthIndex, 1);

    console.log(`\nTesting Month Filter: ${testMonth}`);
    console.log(`Range: ${startDate.toISOString()} -> ${endDate.toISOString()}`);

    // 3. Query with Field Filter
    console.log(`\nQuerying for Field: ${testField.name}`);

    const { data: bookingsField } = await supabase
        .from('bookings')
        .select('id, field_id, start_at')
        .eq('field_id', testField.id)
        .gte('start_at', startDate.toISOString())
        .lt('start_at', endDate.toISOString())
        .not('status', 'in', '("CANCELADA","EXPIRADA")');

    console.log(`Found ${bookingsField?.length || 0} bookings for field ${testField.name} in ${testMonth}`);

    if (bookingsField?.some(b => b.field_id !== testField.id)) {
        console.error('❌ Field Filter FAILED: Found bookings for other fields');
    } else {
        console.log('✅ Field Filter PASSED');
    }

    if (bookingsField?.some(b => new Date(b.start_at) < startDate || new Date(b.start_at) >= endDate)) {
        console.error('❌ Date Filter FAILED: Found bookings outside range');
    } else {
        console.log('✅ Date Filter PASSED');
    }

    // 4. Query Summary (All Fields)
    console.log(`\nQuerying All Fields for ${testMonth}`);
    const { data: bookingsAll } = await supabase
        .from('bookings')
        .select('id, field_id, start_at')
        .gte('start_at', startDate.toISOString())
        .lt('start_at', endDate.toISOString())
        .not('status', 'in', '("CANCELADA","EXPIRADA")');

    console.log(`Found ${bookingsAll?.length || 0} total bookings in ${testMonth}`);

    console.log('--- DONE ---');
}

run();
