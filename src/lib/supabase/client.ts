import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.STORAGE_URL ||
    'https://technosavvys-wms.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.STORAGE_ANON_KEY ||
    'mock_anon_key';

  return createBrowserClient(supabaseUrl, supabaseKey);
}

