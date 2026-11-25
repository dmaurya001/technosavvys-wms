import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request, 'teacher');
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);

    if (isMySQLConfigured()) {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT id, action, entity_type, entity_id, actor, details, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      const logs = Array.isArray(rows)
        ? rows.map((r) => ({
            id: r.id,
            action: r.action,
            entityType: r.entity_type,
            entityId: r.entity_id,
            actor: r.actor || 'system',
            details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || {},
            createdAt: r.created_at,
          }))
        : [];
      return NextResponse.json({ success: true, logs });
    }

    if (isSupabaseConfigured()) {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        return NextResponse.json({
          success: true,
          logs: data.map((r: any) => ({
            id: r.id,
            action: r.action,
            entityType: r.entity_type,
            entityId: r.entity_id,
            actor: 'system',
            details: r.details || {},
            createdAt: r.created_at,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, logs: [] });
  } catch (err: any) {
    console.error('[API /api/audit GET Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load audit logs.' },
      { status: 500 }
    );
  }
}
