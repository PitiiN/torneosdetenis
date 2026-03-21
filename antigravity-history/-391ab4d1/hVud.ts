import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Read from .env if possible, otherwise rely on the actual keys
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_KEY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTestPlayers() {
    console.log("Seeding test players...");

    // 1. Get the tournament "Prueba Final"
    const { data: tournament, error: tErr } = await supabase
        .from("tournaments")
        .select("id")
        .eq("name", "Prueba Final")
        .single();

    if (tErr || !tournament) {
        console.error("Tournament 'Prueba Final' not found", tErr);
        return;
    }

    // 2. Get the first category of that tournament
    const { data: category, error: cErr } = await supabase
        .from("categories")
        .select("id")
        .eq("tournament_id", tournament.id)
        .limit(1)
        .single();

    if (cErr || !category) {
        console.error("No categories found for 'Prueba Final'", cErr);
        return;
    }

    console.log("Found category:", category.id);

    // 3. Create 8 dummy users via Auth Admin (Requires Service Role Key)
    // If we don't have service role key, we can try to just insert into profiles directly 
    // and bypass auth if RLS allows or if we're not actually logging them in.
    // Actually, for dummy players, let's just insert 8 dummy profile rows (UUIDs)

    const dummyUUIDs = [];
    for (let i = 1; i <= 8; i++) {
        dummyUUIDs.push(`00000000-0000-0000-0000-00000000000${i}`);
    }

    const profilesToInsert = dummyUUIDs.map((id, index) => ({
        id,
        first_name: `DummyPlayer_${index + 1}`,
        last_name: "Test",
        email: `dummy${index + 1}@test.com`,
    }));

    const { error: pErr } = await supabase.from("profiles").upsert(profilesToInsert);
    if (pErr) {
        console.error("Error inserting profiles. Make sure RLS allows or use service role key.", pErr);
        return;
    }

    console.log("Inserted dummy profiles.");

    // 4. Register them to the category
    const registrationsToInsert = dummyUUIDs.map(id => ({
        category_id: category.id,
        user_id: id,
        status: "CONFIRMED",
    }));

    const { error: rErr } = await supabase.from("registrations").upsert(registrationsToInsert, { onConflict: "category_id, user_id" });
    if (rErr) {
        console.error("Error inserting registrations", rErr);
        return;
    }

    console.log("Successfully seeded 8 players into", tournament.id);
}

seedTestPlayers();
