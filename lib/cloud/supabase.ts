import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values, inlined at build time (see .env.local). Access to data is
// enforced by row level security in supabase/migrations.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Cloud decks need sign-in. Without the Supabase settings, or with
// NEXT_PUBLIC_DECK_STORAGE=browser (local development, agent tests), decks
// stay in the browser's IndexedDB as before.
export const CLOUD_ENABLED =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  process.env.NEXT_PUBLIC_DECK_STORAGE !== "browser";

export const SUPABASE_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : "";

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!CLOUD_ENABLED) throw new Error("Cloud storage is not configured.");
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Lets the magic link in the sign-in email work as well as the code.
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
  return client;
}

export async function requireUser() {
  const { data, error } = await getSupabase().auth.getSession();
  const user = data.session?.user;
  if (error || !user) throw new Error("Your session has ended. Sign in again.");
  return { id: user.id, email: (user.email ?? "").toLowerCase() };
}
