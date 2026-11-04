import { createClient } from '@supabase/supabase-js';

/**
 * STRICTLY SERVER-SIDE SUPABASE CLIENT (Service Role)
 * Bypasses Row Level Security (RLS) for background system tasks and audit logs.
 * NEVER import or invoke this file from client components.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Service role client must never be instantiated on client-side!');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://technosavvys-wms.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

