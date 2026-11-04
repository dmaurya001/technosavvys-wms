import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export type UserRole = 'teacher' | 'student';

export interface BaseSession {
  sessionId: string;
  role: UserRole;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number; // Absolute session expiry
  iat?: number;
  exp?: number;
}

export interface TeacherSession extends BaseSession {
  role: 'teacher';
  email: string;
  name: string;
}

export interface StudentSession extends BaseSession {
  role: 'student';
  studentId: string;
  name: string;
  phone: string;
  regNo: string;
}

export type AppSession = TeacherSession | StudentSession;

// Configuration Constants
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const TEACHER_ABSOLUTE_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours absolute
export const STUDENT_ABSOLUTE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours absolute

export const TEACHER_COOKIE_NAME = 'technosavvys_teacher_session';
export const ADMIN_COOKIE_NAME = 'technosavvys_admin_session';
export const STUDENT_COOKIE_NAME = 'technosavvys_student_session';
export const LEGACY_STUDENT_COOKIE_NAME = 'technosavvys_student_token';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.STUDENT_SESSION_SECRET ||
  'technosavvys-master-session-security-secret-key-2026';

// Server-side Revoked Sessions Registry (Instant Logout Invalidation)
// Global map prevents memory loss during fast HMR cycles in development
declare global {
  // eslint-disable-next-line no-var
  var __technosavvysRevokedSessions: Map<string, number> | undefined;
}

const revokedSessions: Map<string, number> =
  global.__technosavvysRevokedSessions || new Map<string, number>();

if (!global.__technosavvysRevokedSessions) {
  global.__technosavvysRevokedSessions = revokedSessions;
}

/**
 * Periodically purge revoked session IDs older than the max absolute expiry (8 hours)
 */
function cleanupRevokedSessions() {
  const cutoff = Date.now() - TEACHER_ABSOLUTE_EXPIRY_MS;
  for (const [sessionId, revokedAt] of revokedSessions.entries()) {
    if (revokedAt < cutoff) {
      revokedSessions.delete(sessionId);
    }
  }
}

/**
 * Invalidate a session ID server-side immediately
 */
export function revokeSession(sessionId: string): void {
  if (!sessionId) return;
  revokedSessions.set(sessionId, Date.now());
  cleanupRevokedSessions();
}

/**
 * Check if a session ID has been revoked server-side
 */
export function isSessionRevoked(sessionId: string): boolean {
  if (!sessionId) return false;
  return revokedSessions.has(sessionId);
}

/**
 * Creates a cryptographically signed Teacher Session
 * Absolute Expiry: 8 hours. Idle Expiry: 15 minutes.
 */
export function createTeacherSession(
  email: string,
  name?: string
): { token: string; session: TeacherSession } {
  const now = Date.now();
  const sessionId = `sess_tch_${crypto.randomUUID()}`;

  const session: TeacherSession = {
    sessionId,
    role: 'teacher',
    email: email.trim().toLowerCase(),
    name: name || (email.includes('admin') ? 'Administrator' : 'Lead Instructor'),
    createdAt: now,
    lastActiveAt: now,
    expiresAt: now + TEACHER_ABSOLUTE_EXPIRY_MS,
    iat: now,
    exp: now + TEACHER_ABSOLUTE_EXPIRY_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const token = `${payloadBase64}.${signature}`;
  return { token, session };
}

/**
 * Creates a cryptographically signed Student Session
 * Absolute Expiry: 2 hours. Idle Expiry: 15 minutes.
 */
export function createStudentSession(student: {
  id: string;
  name: string;
  phone: string;
  regNo: string;
}): { token: string; session: StudentSession } {
  const now = Date.now();
  const sessionId = `sess_stu_${crypto.randomUUID()}`;

  const session: StudentSession = {
    sessionId,
    role: 'student',
    studentId: student.id,
    name: student.name,
    phone: student.phone.replace(/\D/g, '').slice(-10),
    regNo: student.regNo,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: now + STUDENT_ABSOLUTE_EXPIRY_MS,
    iat: now,
    exp: now + STUDENT_ABSOLUTE_EXPIRY_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const token = `${payloadBase64}.${signature}`;
  return { token, session };
}

export interface SessionValidationResult {
  valid: boolean;
  session?: AppSession;
  error?: string;
  reason?: 'expired' | 'idle_timeout' | 'revoked' | 'invalid';
}

/**
 * Validates a session token:
 * 1. Cryptographic HMAC-SHA256 signature
 * 2. Instant Server-Side Revocation
 * 3. 15-Minute Inactivity Idle Timeout
 * 4. Absolute Session Expiry (8h Teacher, 2h Student)
 */
export function verifySessionToken(token: string): SessionValidationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Session token missing', reason: 'invalid' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed session token', reason: 'invalid' };
  }

  const [payloadBase64, providedSig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const providedSigBuf = Buffer.from(providedSig);
  const expectedSigBuf = Buffer.from(expectedSig);

  if (
    providedSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
  ) {
    return { valid: false, error: 'Invalid or tampered session signature', reason: 'invalid' };
  }

  try {
    const session: AppSession = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );

    // 1. Check if explicitly revoked on server
    if (session.sessionId && isSessionRevoked(session.sessionId)) {
      return {
        valid: false,
        error: 'Session has been invalidated. Please log in again.',
        reason: 'revoked',
      };
    }

    const now = Date.now();

    // 2. Check Absolute Expiry
    const absoluteExpiry =
      session.expiresAt ||
      (session.role === 'teacher'
        ? (session.createdAt || now) + TEACHER_ABSOLUTE_EXPIRY_MS
        : (session.createdAt || now) + STUDENT_ABSOLUTE_EXPIRY_MS);

    if (now > absoluteExpiry) {
      return {
        valid: false,
        error: 'Session has reached absolute time limit. Please log in again.',
        reason: 'expired',
      };
    }

    // 3. Check 15-Minute Inactivity Idle Timeout
    const lastActive = session.lastActiveAt || session.createdAt || now;
    if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
      return {
        valid: false,
        error: 'Session expired due to 15 minutes of inactivity.',
        reason: 'idle_timeout',
      };
    }

    return { valid: true, session };
  } catch {
    return { valid: false, error: 'Corrupt session payload', reason: 'invalid' };
  }
}

/**
 * Updates lastActiveAt for an active session to implement a sliding inactivity window
 */
export function touchSession(session: AppSession): string {
  const updatedSession: AppSession = {
    ...session,
    lastActiveAt: Date.now(),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(updatedSession)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Sets secure HttpOnly, SameSite, and Secure cookie headers
 */
export function setSessionCookie(
  response: NextResponse,
  cookieName: string,
  token: string,
  maxAgeSeconds: number
): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set(cookieName, token, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
  });
}

/**
 * Clears an authentication cookie
 */
export function clearCookie(response: NextResponse, cookieName: string): void {
  response.cookies.set(cookieName, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
  });
}

/**
 * Extracts and validates session from NextRequest (Cookies or Authorization header)
 */
export function extractAndValidateSession(
  request: NextRequest,
  requiredRole?: UserRole
): SessionValidationResult {
  // 1. Check role-specific cookies
  let token =
    request.cookies.get(TEACHER_COOKIE_NAME)?.value ||
    request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (requiredRole === 'student') {
    token =
      request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
      request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;
  } else if (!token) {
    token =
      request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
      request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;
  }

  // 2. Check Authorization Header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return { valid: false, error: 'Authentication required', reason: 'invalid' };
  }

  const result = verifySessionToken(token);

  if (!result.valid || !result.session) {
    return result;
  }

  // Role validation if required
  if (requiredRole && result.session.role !== requiredRole) {
    return {
      valid: false,
      error: `Forbidden: ${requiredRole === 'teacher' ? 'Teacher' : 'Student'} role required`,
      reason: 'invalid',
    };
  }

  return result;
}
