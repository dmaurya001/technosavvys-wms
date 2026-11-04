import { NextRequest, NextResponse } from 'next/server';
import {
  revokeSession,
  verifySessionToken,
  clearCookie,
  TEACHER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
} from '@/lib/sessionManager';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  // 1. Identify any active session tokens to revoke server-side
  const tokensToCheck = [
    request.cookies.get(TEACHER_COOKIE_NAME)?.value,
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    request.cookies.get(STUDENT_COOKIE_NAME)?.value,
    request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value,
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim(),
  ].filter(Boolean) as string[];

  for (const token of tokensToCheck) {
    try {
      const { session } = verifySessionToken(token);
      if (session?.sessionId) {
        revokeSession(session.sessionId);
        await logAuditEvent({
          action: 'LOGOUT_SESSION_REVOKED',
          entityType: 'Auth',
          details: {
            sessionId: session.sessionId,
            role: session.role,
          },
        });
      }
    } catch {
      // Ignore token decode errors on logout
    }
  }

  // 2. Sign out Supabase auth if applicable
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Non-blocking
  }

  const response = NextResponse.json({
    success: true,
    message: 'Server session invalidated and logged out successfully.',
  });

  // 3. Clear all authentication cookies
  clearCookie(response, TEACHER_COOKIE_NAME);
  clearCookie(response, ADMIN_COOKIE_NAME);
  clearCookie(response, STUDENT_COOKIE_NAME);
  clearCookie(response, LEGACY_STUDENT_COOKIE_NAME);

  return response;
}

export async function GET(request: NextRequest) {
  return POST(request);
}
