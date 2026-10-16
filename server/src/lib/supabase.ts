import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;
let user: SupabaseClient | null = null;

function requireUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set — copy server/.env.example');
  return url;
}

/** Service-role client: bypasses RLS. Server-only, never shipped to the browser. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(requireUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Anon-key client, used for password sign-in and session refresh so the issued JWTs are user-scoped. */
export function supabaseUser(): SupabaseClient {
  if (!user) {
    user = createClient(requireUrl(), process.env.SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return user;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
}
