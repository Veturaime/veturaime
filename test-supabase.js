import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const email = `test_${Date.now()}@example.com`;
    console.log("Trying to register with:", email);
    const { data, error } = await supabase.auth.signUp({
        email,
        password: "Password123!",
        options: {
            data: {
                full_name: "Test User",
                plan_status: "Free"
            }
        }
    });

    if (error) {
        console.error("SignUp Error:", error.message);
    } else {
        console.log("SignUp Success!");

        // Test sign in
        const signInRes = await supabase.auth.signInWithPassword({
            email,
            password: "Password123!"
        });

        if (signInRes.error) {
            console.error("SignIn Error:", signInRes.error.message);
        } else {
            console.log("SignIn Success!");
        }
    }
}

test();
