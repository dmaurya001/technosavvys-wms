import { NextResponse } from 'next/server';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  let mysqlStatus: 'connected' | 'error' | 'not_configured' = 'not_configured';

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery('SELECT 1 AS ok');
      mysqlStatus = 'connected';
    } catch {
      mysqlStatus = 'error';
    }
  }

  const supabaseConfigured = isSupabaseConfigured();
  const ok = mysqlStatus === 'connected' || (!isMySQLConfigured() && supabaseConfigured);

  return NextResponse.json(
    {
      ok,
      database: {
        mysql: mysqlStatus,
        supabase: supabaseConfigured ? 'configured' : 'not_configured',
      },
      timestamp: new Date().toISOString(),
    },
    { status: mysqlStatus === 'error' ? 500 : 200 }
  );
}
