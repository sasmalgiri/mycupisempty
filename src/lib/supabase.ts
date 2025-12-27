import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase client (for use in Client Components)
export const createBrowserClient = () => {
  return createClientComponentClient<Database>();
};

// Server-side Supabase client (for use in Server Components)
export const createServerClient = () => {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
};

// Admin client with service role (for server-side operations that bypass RLS)
export const createAdminClient = () => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Standard client for API routes
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper to get user from session
export async function getUser() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Helper to get user profile with learning style and stats
export async function getUserProfile(userId: string) {
  const supabase = createServerClient();
  
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
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('learning_styles')
    .select('id')
    .eq('user_id', userId)
    .single();
  
  return !!data && !error;
}

// Export types
export type { Database };
