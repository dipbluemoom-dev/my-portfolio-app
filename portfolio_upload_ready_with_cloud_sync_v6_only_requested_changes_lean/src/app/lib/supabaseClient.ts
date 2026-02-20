import { createClient } from '@supabase/supabase-js';

// Vite 환경변수: Vercel(또는 로컬)에서 아래 2개를 반드시 설정하세요.
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
