import { createClient } from './supabase/client';

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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const auditEntry = {
      user_id: user?.id || null,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId || null,
      details: payload.details || {},
      created_at: new Date().toISOString(),
    };

    // Attempt writing to Supabase audit_logs table
    await supabase.from('audit_logs').insert([auditEntry]);
  } catch (err) {
    // Graceful fallback for offline / mock testing
    console.warn('[Audit Log Offline/Mock]:', payload);
  }
}

