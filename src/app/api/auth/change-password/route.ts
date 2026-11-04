import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  extractAndValidateSession,
  revokeSession,
  clearCookie,
  TEACHER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
} from '@/lib/sessionManager';
import {
  verifyAdminPassword,
  updateAdminPassword,
  ADMIN_EMAIL,
} from '@/lib/adminAuth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate caller session
    const check = extractAndValidateSession(request, 'teacher');
    if (!check.valid || !check.session || check.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Unauthorized: Valid administrator session required to change password.' },
        { status: 401 }
      );
    }
    const session = check.session;

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Current password, new password, and confirmation are all required.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password cannot be identical to the current password.' },
        { status: 400 }
      );
    }

    // 2. Verify current password
    const isCurrentValid = verifyAdminPassword(currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Current password verification failed. Please enter your correct current password.' },
        { status: 403 }
      );
    }

    // 3. Update password in admin store (salted PBKDF2)
    const updateResult = updateAdminPassword(newPassword);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.message },
        { status: 400 }
      );
    }

    // 4. Update password in Supabase Auth if connected
    try {
      const supabase = await createClient();
      await supabase.auth.updateUser({ password: newPassword });
    } catch {
      // Ignored for offline fallback
    }

    // 5. Invalidate current session server-side for mandatory re-login
    revokeSession(session.sessionId);

    await logAuditEvent({
      action: 'ADMIN_PASSWORD_CHANGED',
      entityType: 'Auth',
      details: {
        email: ADMIN_EMAIL,
        sessionId: session.sessionId,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: 'Password updated successfully. All sessions terminated. Please sign in with your new password.',
    });

    // Clear session cookies to enforce re-login
    clearCookie(response, TEACHER_COOKIE_NAME);
    clearCookie(response, ADMIN_COOKIE_NAME);

    return response;
  } catch (err: any) {
    console.error('[Change Password API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error changing administrator password.' },
      { status: 500 }
    );
  }
}
