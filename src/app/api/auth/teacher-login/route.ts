import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createTeacherSession,
  setSessionCookie,
  TEACHER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  TEACHER_ABSOLUTE_EXPIRY_MS,
} from '@/lib/sessionManager';
import {
  isAdminIdentifier,
  verifyAdminPassword,
  ADMIN_EMAIL,
  ADMIN_NAME,
} from '@/lib/adminAuth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email / username and password are required.' },
        { status: 400 }
      );
    }

    const inputIdentifier = email.trim();
    let authenticatedEmail = inputIdentifier.toLowerCase();
    let administratorName = ADMIN_NAME;
    let role = 'admin';
    let isAuthenticated = false;

    // Check if input matches permanent super-admin (Email or Username)
    const isAdminAccount = isAdminIdentifier(inputIdentifier);

    if (isAdminAccount) {
      authenticatedEmail = ADMIN_EMAIL;
      // 1. Verify against secure server-side salted PBKDF2 hash
      if (verifyAdminPassword(password)) {
        isAuthenticated = true;
      }
    }

    // 2. Try Supabase Authentication if not yet verified
    if (!isAuthenticated) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authenticatedEmail,
          password,
        });

        if (!error && data?.user) {
          // Verify educator or admin role from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', data.user.id)
            .single();

          if (profile && (profile.role === 'admin' || profile.role === 'instructor')) {
            isAuthenticated = true;
            role = profile.role;
            if (profile.full_name) administratorName = profile.full_name;
          }
        }
      } catch {
        // Supabase offline / fallback
      }
    }

    // Strict rejection of unauthenticated or unauthorized credentials
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid administrator credentials. Access denied.' },
        { status: 401 }
      );
    }

    // 3. Issue Cryptographic Teacher / Admin Session Token
    const { token, session } = createTeacherSession(authenticatedEmail, administratorName);

    await logAuditEvent({
      action: 'ADMIN_LOGIN',
      entityType: 'Auth',
      details: {
        email: authenticatedEmail,
        role,
        sessionId: session.sessionId,
      },
    });

    const response = NextResponse.json({
      success: true,
      teacher: {
        email: session.email,
        name: session.name,
        role: session.role,
        expiresAt: session.expiresAt,
      },
    });

    // 4. Set HttpOnly, Secure, SameSite=Lax Session Cookies (8 Hours)
    const maxAgeSeconds = Math.floor(TEACHER_ABSOLUTE_EXPIRY_MS / 1000);
    setSessionCookie(response, TEACHER_COOKIE_NAME, token, maxAgeSeconds);
    setSessionCookie(response, ADMIN_COOKIE_NAME, token, maxAgeSeconds);

    return response;
  } catch (err: any) {
    console.error('[Admin Login API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error processing administrator login.' },
      { status: 500 }
    );
  }
}
