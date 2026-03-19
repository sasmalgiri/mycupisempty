import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient as createSSRBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client-side Supabase client (uses @supabase/ssr so cookies sync with middleware)
let browserClient: SupabaseClient<Database> | null = null;

export const createBrowserClient = (): SupabaseClient<Database> => {
  if (!browserClient) {
    browserClient = createSSRBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
};

// Server-side Supabase client (for use in Server Components and API routes)
export const createServerClient = async (): Promise<SupabaseClient<Database>> => {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: any) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
};

// Admin client with service role (for server-side operations that bypass RLS)
export const createAdminClient = (): SupabaseClient<Database> => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Standard client for API routes (lazy-loaded to avoid build-time errors)
let _supabase: SupabaseClient<Database> | null = null;
export const getSupabase = (): SupabaseClient<Database> => {
  if (!_supabase) {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
};

// Helper to get user from session
export async function getUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Helper to get user profile with learning style and stats
export async function getUserProfile(userId: string) {
  const supabase = await createServerClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      learning_styles (*),
      multiple_intelligences (*),
      user_stats (*)
    `)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return profile;
}

// Helper to check if user has completed VARK assessment
export async function hasCompletedVARKAssessment(userId: string): Promise<boolean> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('learning_styles')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !!data && !error;
}

// Export types
export type { Database };
