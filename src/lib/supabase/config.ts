/**
 * Supabase Configuration & Status Verifier
 * Distinguishes between active production Supabase instances and mock/placeholder configurations.
 */

export function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.STORAGE_URL ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STORAGE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.STORAGE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.STORAGE_ANON_KEY ||
    '';
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) return false;

  // Placeholder and mock detection
  if (
    url.includes('technosavvys-wms.supabase.co') ||
    url.includes('<your-project-ref>') ||
    url.includes('placeholder')
  ) {
    return false;
  }

  if (
    key.includes('mock_') ||
    key.includes('<your-') ||
    key.length < 25
  ) {
    return false;
  }

  return true;
}

export function getSupabaseConfigStatus(): {
  configured: boolean;
  url: string;
  isPlaceholder: boolean;
  message: string;
} {
  const { url, key } = getSupabaseEnv();

  const configured = isSupabaseConfigured();
  const isPlaceholder = !configured && (url.includes('technosavvys-wms.supabase.co') || key.includes('mock_'));

  let message = 'Supabase PostgreSQL is connected as the primary single source of truth.';
  if (!url || !key) {
    message = 'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are missing.';
  } else if (isPlaceholder) {
    message = 'Using placeholder Supabase URL (technosavvys-wms.supabase.co). Running with server-side persistent store fallback.';
  }

  return {
    configured,
    url: configured ? url : 'mock://offline-fallback',
    isPlaceholder,
    message,
  };
}

