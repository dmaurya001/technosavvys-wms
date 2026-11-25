import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  createTeacherSession,
  setSessionCookie,
  TEACHER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  TEACHER_ABSOLUTE_EXPIRY_MS,
} from '@/lib/sessionManager';
import {
  verifyAdminPasswordFromDb,
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

    // 1. Verify against MySQL `admins` table or env salted PBKDF2 hash
    const adminCheck = await verifyAdminPasswordFromDb(inputIdentifier, password);
    if (adminCheck.valid) {
      authenticatedEmail = adminCheck.email;
      administratorName = adminCheck.name;
      role = adminCheck.role;
      isAuthenticated = true;
    }

    // 2. Try Supabase Authentication if configured and not yet verified
    if (!isAuthenticated && isSupabaseConfigured()) {
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
    setSessionCookie(response, TEACHER_COOKIE_NAME, token, maxAgeSeconds, request);
    setSessionCookie(response, ADMIN_COOKIE_NAME, token, maxAgeSeconds, request);

    return response;
  } catch (err: any) {
    console.error('[Admin Login API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error processing administrator login.' },
      { status: 500 }
    );
  }
}
