import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables. Check .env configuration.");
}

declare global {
  var __veturaimeSupabaseClient: ReturnType<typeof createSupabaseClient> | undefined;
}

export const supabase =
  globalThis.__veturaimeSupabaseClient ?? createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (import.meta.env.DEV) {
  globalThis.__veturaimeSupabaseClient = supabase;
}

export type OnboardingAnswers = {
  transmission_preference: string | null;
  car_body_preference: string | null;
  car_style_preference: string | null;
  fuel_consumption_priority: string | null;
  electric_future_preference: string | null;
};

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

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

function isMissingOnboardingColumnError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  return (
    normalized.includes("onboarding_completed_at") ||
    normalized.includes("transmission_preference") ||
    normalized.includes("car_body_preference") ||
    normalized.includes("car_style_preference") ||
    normalized.includes("fuel_consumption_priority") ||
    normalized.includes("electric_future_preference")
  );
}

function onboardingMigrationMessage() {
  return "Kolonat e onboarding mungojnë në DB. Ekzekuto SQL-in te supabase/onboarding_profile_columns.sql dhe provo përsëri.";
}

export async function hasCompletedOnboarding() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return false;
    }

    if (isMissingOnboardingColumnError(error.message)) {
      return false;
    }

    throw new Error(error.message);
  }

  return Boolean(data?.onboarding_completed_at);
}

export async function saveOnboardingAnswers(answers: OnboardingAnswers) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("Nuk ka sesion aktiv. Hyr përsëri.");
  }

  const payload = {
    ...answers,
    onboarding_completed_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);

  if (error) {
    if (isMissingOnboardingColumnError(error.message)) {
      throw new Error(onboardingMigrationMessage());
    }

    throw new Error(error.message);
  }
}
