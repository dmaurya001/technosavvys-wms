// Edge-safe session validator for Next.js Middleware (Web Crypto API)

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const TEACHER_ABSOLUTE_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
export const STUDENT_ABSOLUTE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

export const TEACHER_COOKIE_NAME = 'technosavvys_teacher_session';
export const ADMIN_COOKIE_NAME = 'technosavvys_admin_session';
export const STUDENT_COOKIE_NAME = 'technosavvys_student_session';
export const LEGACY_STUDENT_COOKIE_NAME = 'technosavvys_student_token';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.STUDENT_SESSION_SECRET ||
  'technosavvys-master-session-security-secret-key-2026';

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface EdgeSessionResult {
  valid: boolean;
  role?: 'teacher' | 'student';
  payload?: any;
  error?: string;
  reason?: 'expired' | 'idle_timeout' | 'revoked' | 'invalid';
}

/**
 * Validates a session token inside Edge Runtime using Web Crypto API
 */
export async function verifyEdgeSessionToken(token: string): Promise<EdgeSessionResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing', reason: 'invalid' };
  }


  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token', reason: 'invalid' };
  }

  const [payloadBase64, providedSigBase64] = parts;

  try {
    // 1. Verify HMAC signature with Web Crypto
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const providedSigBytes = base64UrlToUint8Array(providedSigBase64);
    const isValidSig = await crypto.subtle.verify(
      'HMAC',
      key,
      providedSigBytes as any,
      enc.encode(payloadBase64)
    );

    if (!isValidSig) {
      return { valid: false, error: 'Invalid token signature', reason: 'invalid' };
    }

    // 2. Parse payload
    const decodedPayloadStr = new TextDecoder().decode(base64UrlToUint8Array(payloadBase64));
    const payload = JSON.parse(decodedPayloadStr);

    const role: 'teacher' | 'student' =
      payload.role || (payload.email ? 'teacher' : 'student');

    const now = Date.now();

    // 3. Absolute Expiry Check
    const maxDuration =
      role === 'teacher' ? TEACHER_ABSOLUTE_EXPIRY_MS : STUDENT_ABSOLUTE_EXPIRY_MS;
    const absoluteExpiry =
      payload.expiresAt || payload.exp || (payload.createdAt ? payload.createdAt + maxDuration : now + maxDuration);

    if (now > absoluteExpiry) {
      return {
        valid: false,
        role,
        error: 'Absolute session expiry reached',
        reason: 'expired',
      };
    }

    // 4. Inactivity Idle Timeout Check (15 minutes)
    const lastActive = payload.lastActiveAt || payload.iat || payload.createdAt || now;
    if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
      return {
        valid: false,
        role,
        error: 'Session expired due to 15 minutes of inactivity',
        reason: 'idle_timeout',
      };
    }

    return {
      valid: true,
      role,
      payload,
    };
  } catch {
    return { valid: false, error: 'Failed to verify session token', reason: 'invalid' };
  }
}
