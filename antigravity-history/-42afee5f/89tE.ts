import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function wipeTournaments() {
    console.log("Fetching tournaments...");
    const { data: tournaments, error: listError } = await supabase.from("tournaments").select("id");

    if (listError) {
        console.error("Error fetching tournaments:", listError);
        return;
    }

    if (!tournaments || tournaments.length === 0) {
        console.log("No tournaments found.");
        return;
    }

    console.log(`Found ${tournaments.length} tournaments to delete.`);

    // Attempting to delete them. If ON DELETE CASCADE is properly configured, this is enough.
    for (const t of tournaments) {
        console.log(`Deleting tournament: ${t.id}`);
        const { error: delError } = await supabase.from("tournaments").delete().eq("id", t.id);
        if (delError) {
            console.error(`Failed to delete ${t.id}:`, delError);
        } else {
            console.log(`Successfully deleted ${t.id}`);
        }
    }

    console.log("Done wiping tournaments.");
}

wipeTournaments();
