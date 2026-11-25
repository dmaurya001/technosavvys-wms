import crypto from 'crypto';
import { isSupabaseConfigured } from './supabase/config';
import { createAdminClient } from './supabase/admin';
import { isMySQLConfigured, executeMySQLQuery } from './mysql';

export interface AuditLogPayload {
  action:
    | 'CREATE_WORKSHOP'
    | 'UPDATE_WORKSHOP'
    | 'DELETE_WORKSHOP'
    | 'MARK_ATTENDANCE'
    | 'ENROLL_STUDENT'
    | 'ISSUE_CERTIFICATE'
    | 'ADMIN_LOGIN'
    | 'ADMIN_LOGOUT'
    | 'STUDENT_OTP_REQUEST'
    | 'STUDENT_OTP_VERIFIED'
    | 'STUDENT_CERTIFICATE_DOWNLOAD'
    | 'SECURITY_UNAUTHORIZED_ACCESS_BLOCKED'
    | string;
  entityType: 'Workshop' | 'Attendance' | 'Student' | 'Certificate' | 'Auth' | 'Security';
  entityId?: string;
  details?: Record<string, any>;
}

export async function logAuditEvent(payload: AuditLogPayload) {
  try {
    if (isMySQLConfigured()) {
      const id = `AUD-${crypto.randomUUID()}`;
      await executeMySQLQuery(
        `INSERT INTO audit_logs (id, action, entity_type, entity_id, actor, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          payload.action,
          payload.entityType,
          payload.entityId || null,
          'system',
          JSON.stringify(payload.details || {}),
        ]
      );
      return;
    }

    if (isSupabaseConfigured()) {
      const supabase = createAdminClient();
      const auditEntry = {
        action: payload.action,
        entity_type: payload.entityType,
        entity_id: payload.entityId || null,
        details: payload.details || {},
        created_at: new Date().toISOString(),
      };
      await supabase.from('audit_logs').insert([auditEntry]);
    }
  } catch (err) {
    // Graceful fallback for offline / mock testing
    console.warn('[Audit Log Offline/Mock]:', payload);
  }
}

