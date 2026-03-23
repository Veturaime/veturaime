import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pijcahpqevnuvcnlmfzo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpamNhaHBxZXZudXZjbmxtZnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjkzMzYsImV4cCI6MjA4NzcwNTMzNn0.Z0f5XDUSgfA_oq_tMzitoUGcs-nLMTR6zTy2HN8Nd6o";

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
