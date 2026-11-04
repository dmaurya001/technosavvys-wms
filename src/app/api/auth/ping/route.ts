import { NextRequest, NextResponse } from 'next/server';
import {
  extractAndValidateSession,
  touchSession,
  setSessionCookie,
  TEACHER_COOKIE_NAME,
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  TEACHER_ABSOLUTE_EXPIRY_MS,
  STUDENT_ABSOLUTE_EXPIRY_MS,
  INACTIVITY_TIMEOUT_MS,
} from '@/lib/sessionManager';

export async function POST(request: NextRequest) {
  const result = extractAndValidateSession(request);

  if (!result.valid || !result.session) {
    return NextResponse.json(
      {
        valid: false,
        error: result.error || 'Session expired or invalid',
        reason: result.reason || 'invalid',
      },
      { status: 401 }
    );
  }

  const { session } = result;
  const newToken = touchSession(session);
  const response = NextResponse.json({
    valid: true,
    role: session.role,
    idleExpiresAt: Date.now() + INACTIVITY_TIMEOUT_MS,
    expiresAt: session.expiresAt,
  });

  const maxAge = Math.floor(
    (session.role === 'teacher' ? TEACHER_ABSOLUTE_EXPIRY_MS : STUDENT_ABSOLUTE_EXPIRY_MS) / 1000
  );

  if (session.role === 'teacher') {
    setSessionCookie(response, TEACHER_COOKIE_NAME, newToken, maxAge);
  } else {
    setSessionCookie(response, STUDENT_COOKIE_NAME, newToken, maxAge);
    setSessionCookie(response, LEGACY_STUDENT_COOKIE_NAME, newToken, maxAge);
  }

  return response;
}

export async function GET(request: NextRequest) {
  return POST(request);
}
