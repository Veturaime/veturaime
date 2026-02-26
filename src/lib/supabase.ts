import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables. Check .env configuration.");
}

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
};

export async function registerWithEmail({ fullName, email, password }: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim()
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function quickStart(flow: "dashboard" | "register", inputValue: string) {
  const query = new URLSearchParams({ flow, q: inputValue || "" });
  const fallbackTarget = `/dashboard?${query.toString()}`;

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      window.location.href = fallbackTarget;
      return;
    }

    const sessionToken = data?.session?.access_token;
    if (sessionToken) {
      sessionStorage.setItem("veturaime_access_token", sessionToken);
    }

    window.location.href = fallbackTarget;
  } catch {
    window.location.href = fallbackTarget;
  }
}
