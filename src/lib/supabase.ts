import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CarInput,
  CarRow,
  Database,
  DocumentRow,
  ExpenseRow,
  NotificationRow,
  ProfileRow,
  ServiceRecordRow
} from "./database.types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables. Check .env configuration.");
}

type AppSupabaseClient = SupabaseClient<Database>;

declare global {
  var __veturaimeSupabaseClient: AppSupabaseClient | undefined;
}

export const supabase: AppSupabaseClient =
  globalThis.__veturaimeSupabaseClient ??
  createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

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

export type DashboardData = {
  profile: ProfileRow | null;
  cars: CarRow[];
  serviceRecords: ServiceRecordRow[];
  documents: DocumentRow[];
  expenses: ExpenseRow[];
};

export type VehicleDashboardData = {
  car: CarRow;
  documents: DocumentRow[];
  serviceRecords: ServiceRecordRow[];
  expenses: ExpenseRow[];
};

export type NotificationQueryOptions = {
  carId?: string;
  includeRead?: boolean;
  limit?: number;
};

type ReminderTriggerKind = "due_30" | "due_7" | "due_today_or_overdue";

type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
};

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

function isMissingDashboardSchemaError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  return (
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    (normalized.includes("relation") &&
      ["cars", "service_records", "documents", "expenses", "notifications"].some((tableName) =>
        normalized.includes(tableName)
      ))
  );
}

function onboardingMigrationMessage() {
  return "Onboarding columns are missing in DB. Run supabase/onboarding_profile_columns.sql and try again.";
}

function dashboardMigrationMessage() {
  return "Dashboard tables are missing in DB. Run supabase/dashboard_core.sql and try again.";
}

function throwQueryError(error: { message: string } | null) {
  if (!error) {
    return;
  }

  if (isMissingOnboardingColumnError(error.message)) {
    throw new Error(onboardingMigrationMessage());
  }

  if (isMissingDashboardSchemaError(error.message)) {
    throw new Error(dashboardMigrationMessage());
  }

  throw new Error(error.message);
}

function toLocalDate(input: string) {
  return new Date(`${input}T00:00:00`);
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDiffDays(dueAt: string) {
  const dueDate = toLocalDate(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const today = getTodayStart();
  const diff = dueDate.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getReminderTriggers(diffDays: number): ReminderTriggerKind[] {
  const triggers: ReminderTriggerKind[] = [];

  if (diffDays <= 30) {
    triggers.push("due_30");
  }

  if (diffDays <= 7) {
    triggers.push("due_7");
  }

  if (diffDays <= 0) {
    triggers.push("due_today_or_overdue");
  }

  return triggers;
}

function formatDocumentReminderMessage(documentType: string, diffDays: number) {
  if (diffDays < 0) {
    return `Dokumenti ${documentType} është i skaduar.`;
  }

  if (diffDays === 0) {
    return `Dokumenti ${documentType} skadon sot.`;
  }

  return `Dokumenti ${documentType} skadon për ${diffDays} ditë.`;
}

function formatServiceReminderMessage(serviceType: string, diffDays: number) {
  if (diffDays < 0) {
    return `Servisimi ${serviceType} është kaluar dhe kërkon vëmendje.`;
  }

  if (diffDays === 0) {
    return `Servisimi ${serviceType} është planifikuar për sot.`;
  }

  return `Servisimi ${serviceType} është planifikuar për ${diffDays} ditë.`;
}

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

export async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

// =====================================================
// VERIFICATION CODE FUNCTIONS
// =====================================================

export async function generateVerificationCode(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  // Generate code using database function if available, otherwise client-side
  try {
    const { data, error } = await supabase.rpc("generate_verification_code", {
      p_user_id: userId
    });
    
    if (error) {
      // Fallback to client-side generation if function doesn't exist
      if (error.message.includes("function") || error.message.includes("does not exist")) {
        return generateVerificationCodeClientSide(userId);
      }
      throw new Error(error.message);
    }
    
    return data as string;
  } catch {
    // Fallback to client-side generation
    return generateVerificationCodeClientSide(userId);
  }
}

async function generateVerificationCodeClientSide(userId: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
  
  // Invalidate existing codes
  await supabase
    .from("verification_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
  
  // Insert new code
  const { error } = await supabase
    .from("verification_codes")
    .insert({
      user_id: userId,
      code,
      purpose: "email_verification",
      expires_at: expiresAt
    });
  
  if (error) {
    // If table doesn't exist, return mock code for demo purposes
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("Verification codes table not found. Using demo mode with code:", code);
      // Store in session for demo
      sessionStorage.setItem("veturaime_demo_code", code);
      return code;
    }
    throw new Error(error.message);
  }
  
  return code;
}

export async function verifyCode(code: string): Promise<boolean> {
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  // Check demo mode first
  const demoCode = sessionStorage.getItem("veturaime_demo_code");
  if (demoCode && demoCode === code) {
    sessionStorage.removeItem("veturaime_demo_code");
    // Update profile
    await supabase
      .from("profiles")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", userId);
    return true;
  }

  // Try database function
  try {
    const { data, error } = await supabase.rpc("verify_code", {
      p_user_id: userId,
      p_code: code
    });
    
    if (error) {
      // Fallback to client-side verification
      if (error.message.includes("function") || error.message.includes("does not exist")) {
        return verifyCodeClientSide(userId, code);
      }
      throw new Error(error.message);
    }
    
    return data as boolean;
  } catch {
    return verifyCodeClientSide(userId, code);
  }
}

async function verifyCodeClientSide(userId: string, code: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  // Find valid code
  const { data, error } = await supabase
    .from("verification_codes")
    .select("*")
    .eq("user_id", userId)
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", now)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  // Mark as used
  await supabase
    .from("verification_codes")
    .update({ used_at: now })
    .eq("id", data.id);
  
  // Update profile
  await supabase
    .from("profiles")
    .update({ email_verified_at: now })
    .eq("id", userId);
  
  return true;
}

export async function isEmailVerified(): Promise<boolean> {
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .single();
  
  if (error) {
    // If column doesn't exist, skip verification
    if (error.message.includes("email_verified_at")) {
      return true;
    }
    return false;
  }
  
  return Boolean(data?.email_verified_at);
}

// =====================================================
// ONBOARDING FUNCTIONS
// =====================================================

export async function hasCompletedOnboarding() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return false;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

  if (error) {
    if (error.code === "PGRST116") {
      return false;
    }

    if (isMissingOnboardingColumnError(error.message)) {
      return false;
    }

    throw new Error(error.message);
  }

  return Boolean((data as ProfileRow | null)?.onboarding_completed_at);
}

export async function saveOnboardingAnswers(answers: OnboardingAnswers) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const payload: Database["public"]["Tables"]["profiles"]["Update"] = {
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

// =====================================================
// CAR SELECTION FUNCTIONS
// =====================================================

export async function hasCompletedCarSelection(): Promise<boolean> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return false;
  }

  // Check if user has at least one car
  const { data, error } = await supabase
    .from("cars")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  if (error) {
    // If table doesn't exist, skip this check
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return false;
    }
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function createCar(carData: CarInput): Promise<CarRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("cars")
    .insert({
      owner_id: userId,
      ...carData
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Mark car selection as completed
  await supabase
    .from("profiles")
    .update({ car_selection_completed_at: new Date().toISOString() })
    .eq("id", userId);

  return data as CarRow;
}

export async function updateCar(carId: string, carData: Partial<CarInput>): Promise<CarRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("cars")
    .update(carData)
    .eq("id", carId)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CarRow;
}

export async function getUserCars(): Promise<CarRow[]> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("owner_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as CarRow[]) ?? [];
}

export async function getCarById(carId: string): Promise<CarRow | null> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("id", carId)
    .eq("owner_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data as CarRow;
}

// =====================================================
// VEHICLE DASHBOARD DATA
// =====================================================

export async function getVehicleDashboardData(carId: string): Promise<VehicleDashboardData> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const [carResult, documentsResult, servicesResult, expensesResult] = await Promise.all([
    supabase.from("cars").select("*").eq("id", carId).eq("owner_id", userId).single(),
    supabase
      .from("documents")
      .select("*")
      .eq("car_id", carId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_records")
      .select("*")
      .eq("car_id", carId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("*")
      .eq("car_id", carId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
  ]);

  throwQueryError(carResult.error);
  throwQueryError(documentsResult.error);
  throwQueryError(servicesResult.error);
  throwQueryError(expensesResult.error);

  if (!carResult.data) {
    throw new Error("Vehicle not found.");
  }

  return {
    car: carResult.data as CarRow,
    documents: (documentsResult.data as DocumentRow[]) ?? [],
    serviceRecords: (servicesResult.data as ServiceRecordRow[]) ?? [],
    expenses: (expensesResult.data as ExpenseRow[]) ?? []
  };
}

// =====================================================
// DOCUMENT MANAGEMENT
// =====================================================

export async function createDocument(doc: Database["public"]["Tables"]["documents"]["Insert"]): Promise<DocumentRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      ...doc,
      owner_id: userId
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DocumentRow;
}

export async function updateDocument(
  docId: string, 
  updates: Database["public"]["Tables"]["documents"]["Update"]
): Promise<DocumentRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", docId)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DocumentRow;
}

export async function deleteDocument(docId: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId)
    .eq("owner_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

// =====================================================
// SERVICE RECORDS
// =====================================================

export async function createServiceRecord(
  record: Database["public"]["Tables"]["service_records"]["Insert"]
): Promise<ServiceRecordRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("service_records")
    .insert({
      ...record,
      owner_id: userId
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data?.mileage === "number" && Number.isFinite(data.mileage)) {
    const { error: mileageUpdateError } = await supabase
      .from("cars")
      .update({ mileage: data.mileage })
      .eq("id", data.car_id)
      .eq("owner_id", userId);

    if (mileageUpdateError) {
      throw new Error(mileageUpdateError.message);
    }
  }

  return data as ServiceRecordRow;
}

export async function updateServiceRecord(
  recordId: string,
  updates: Database["public"]["Tables"]["service_records"]["Update"]
): Promise<ServiceRecordRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("service_records")
    .update(updates)
    .eq("id", recordId)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ServiceRecordRow;
}

export async function deleteServiceRecord(recordId: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { error } = await supabase
    .from("service_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recordId)
    .eq("owner_id", userId);

  if (error && error.message.toLowerCase().includes("deleted_at")) {
    const { error: fallbackError } = await supabase
      .from("service_records")
      .delete()
      .eq("id", recordId)
      .eq("owner_id", userId);

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

// =====================================================
// EXPENSES
// =====================================================

export async function createExpense(
  expense: Database["public"]["Tables"]["expenses"]["Insert"]
): Promise<ExpenseRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...expense,
      owner_id: userId
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ExpenseRow;
}

export async function updateExpense(
  expenseId: string,
  updates: Database["public"]["Tables"]["expenses"]["Update"]
): Promise<ExpenseRow> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", expenseId)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ExpenseRow;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("owner_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

// =====================================================
// NOTIFICATIONS / REMINDERS
// =====================================================

export async function syncDueNotifications(carId?: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  let documentsQuery = supabase
    .from("documents")
    .select("id, car_id, document_type, expires_on")
    .eq("owner_id", userId)
    .not("expires_on", "is", null);

  let servicesQuery = supabase
    .from("service_records")
    .select("id, car_id, service_type, next_service_due_at")
    .eq("owner_id", userId)
    .not("next_service_due_at", "is", null);

  if (carId) {
    documentsQuery = documentsQuery.eq("car_id", carId);
    servicesQuery = servicesQuery.eq("car_id", carId);
  }

  const [documentsResult, servicesResult] = await Promise.all([documentsQuery, servicesQuery]);

  throwQueryError(documentsResult.error);
  throwQueryError(servicesResult.error);

  const notificationsToUpsert: Database["public"]["Tables"]["notifications"]["Insert"][] = [];

  for (const document of documentsResult.data ?? []) {
    if (!document.expires_on) {
      continue;
    }

    const diffDays = getDiffDays(document.expires_on);

    if (diffDays === null || diffDays > 30) {
      continue;
    }

    const triggerKinds = getReminderTriggers(diffDays);

    for (const triggerKind of triggerKinds) {
      notificationsToUpsert.push({
        owner_id: userId,
        car_id: document.car_id,
        source_type: "document",
        source_id: document.id,
        trigger_kind: triggerKind,
        due_at: document.expires_on,
        message: formatDocumentReminderMessage(document.document_type, diffDays)
      });
    }
  }

  for (const service of servicesResult.data ?? []) {
    if (!service.next_service_due_at) {
      continue;
    }

    const diffDays = getDiffDays(service.next_service_due_at);

    if (diffDays === null || diffDays > 30) {
      continue;
    }

    const triggerKinds = getReminderTriggers(diffDays);

    for (const triggerKind of triggerKinds) {
      notificationsToUpsert.push({
        owner_id: userId,
        car_id: service.car_id,
        source_type: "service",
        source_id: service.id,
        trigger_kind: triggerKind,
        due_at: service.next_service_due_at,
        message: formatServiceReminderMessage(service.service_type, diffDays)
      });
    }
  }

  if (notificationsToUpsert.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .upsert(notificationsToUpsert, {
      onConflict: "owner_id,source_type,source_id,trigger_kind",
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getNotifications(options: NotificationQueryOptions = {}): Promise<NotificationRow[]> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { carId, includeRead = true, limit = 20 } = options;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("owner_id", userId)
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (carId) {
    query = query.eq("car_id", carId);
  }

  if (!includeRead) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  throwQueryError(error);

  return (data as NotificationRow[] | null) ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("owner_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead(carId?: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("owner_id", userId)
    .is("read_at", null);

  if (carId) {
    query = query.eq("car_id", carId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

// =====================================================
// GENERAL DASHBOARD
// =====================================================

export async function getDashboardData(): Promise<DashboardData> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("No active session. Sign in again.");
  }

  const [profileResult, carsResult, servicesResult, documentsResult, expensesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("cars").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("service_records")
      .select("*")
      .eq("owner_id", userId)
      .order("service_date", { ascending: false })
      .limit(6),
    supabase
      .from("documents")
      .select("*")
      .eq("owner_id", userId)
      .order("expires_on", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("expenses")
      .select("*")
      .eq("owner_id", userId)
      .order("expense_date", { ascending: false })
      .limit(8)
  ]);

  throwQueryError(profileResult.error);
  throwQueryError(carsResult.error);
  throwQueryError(servicesResult.error);
  throwQueryError(documentsResult.error);
  throwQueryError(expensesResult.error);

  return {
    profile: (profileResult.data as ProfileRow | null) ?? null,
    cars: (carsResult.data as CarRow[] | null) ?? [],
    serviceRecords: (servicesResult.data as ServiceRecordRow[] | null) ?? [],
    documents: (documentsResult.data as DocumentRow[] | null) ?? [],
    expenses: (expensesResult.data as ExpenseRow[] | null) ?? []
  };
}

export async function signOutCurrentUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
