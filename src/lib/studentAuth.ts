import crypto from 'crypto';
import type { Student } from '../types';

/**
 * Normalizes phone number to 10-digit format for strict comparison
 * e.g., '+91 98765 43210' -> '9876543210'
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalizes student name (lowercase, collapse whitespace)
 */
export function normalizeStudentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Masks student email address for privacy and secure disambiguation
 * e.g., 'aditya.verma@gmail.com' -> 'a***a@gmail.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Masks student phone number for privacy
 * e.g., '9876543210' -> '+91 ******3210'
 */
export function maskPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone || '';
  return `+91 ******${digits.slice(-4)}`;
}

/**
 * Normalizes identifier (email or phone) for uniform lookup and OTP keying
 */
export function normalizeIdentifier(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return normalizePhoneNumber(trimmed);
}

// In-memory OTP storage structure
interface StoredOtp {
  hash: string;
  expiresAt: number;
  attempts: number;
  studentId: string;
  fullName: string;
}

const otpStore = new Map<string, StoredOtp>();

// Secret key for signing student session tokens
const HMAC_SECRET = process.env.STUDENT_SESSION_SECRET;
if (!HMAC_SECRET) {
  throw new Error('STUDENT_SESSION_SECRET is not set');
}

/**
 * Generates a cryptographically random 6-digit OTP
 * and stores a SHA-256 hash valid for 5 minutes.
 * Accepts either phone number or email address as identifier.
 */
export function generateStudentOtp(identifier: string, studentId: string, fullName: string): string {
  const cleanId = normalizeIdentifier(identifier);
  
  // Cryptographically secure 6-digit number between 100000 and 999999
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  
  // Hash the OTP with identifier salt
  const hash = crypto
    .createHmac('sha256', HMAC_SECRET!)
    .update(`${cleanId}:${otpCode}`)
    .digest('hex');

  otpStore.set(cleanId, {
    hash,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
    attempts: 0,
    studentId,
    fullName,
  });

  return otpCode;
}

/**
 * Verifies a submitted OTP against the stored hash.
 * Enforces maximum 3 incorrect attempts.
 * Accepts either phone number or email address as identifier.
 */
export function verifyStudentOtp(
  identifier: string,
  submittedOtp: string
): { success: boolean; studentId?: string; fullName?: string; error?: string } {
  const cleanId = normalizeIdentifier(identifier);
  const record = otpStore.get(cleanId);

  if (!record) {
    return { success: false, error: 'OTP expired or not requested. Please request a new code.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanId);
    return { success: false, error: 'OTP has expired. Please request a new code.' };
  }

  if (record.attempts >= 3) {
    otpStore.delete(cleanId);
    return { success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
  }

  const computedHash = crypto
    .createHmac('sha256', HMAC_SECRET!)
    .update(`${cleanId}:${submittedOtp.trim()}`)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(record.hash, 'hex'),
    Buffer.from(computedHash, 'hex')
  );

  if (!isMatch) {
    record.attempts += 1;
    const remaining = 3 - record.attempts;
    return {
      success: false,
      error: `Invalid OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Successfully verified - clear OTP record to prevent replay
  const { studentId, fullName } = record;
  otpStore.delete(cleanId);

  return { success: true, studentId, fullName };
}

import {
  createStudentSession,
  verifySessionToken,
  STUDENT_ABSOLUTE_EXPIRY_MS,
  INACTIVITY_TIMEOUT_MS,
} from './sessionManager.ts';

export interface StudentSessionPayload {
  studentId: string;
  name: string;
  phone: string;
  email?: string;
  regNo: string;
  exp: number;
  iat: number;
  role?: string;
  sessionId?: string;
  lastActiveAt?: number;
  createdAt?: number;
}

/**
 * Creates an HMAC-SHA256 signed student session token.
 * Absolute expiry: 2 hours. Inactivity timeout: 15 minutes.
 */
export function createStudentSessionToken(student: {
  id: string;
  name: string;
  phone: string;
  email?: string;
  regNo: string;
}): string {
  const { token } = createStudentSession(student);
  return token;
}

/**
 * Validates the HMAC signature and expiration of a student session token.
 */
export function verifyStudentSessionToken(token: string): StudentSessionPayload {
  const result = verifySessionToken(token);
  if (!result.valid || !result.session) {
    throw new Error(result.error || 'Invalid or expired student authorization token');
  }

  const s = result.session as any;
  return {
    studentId: s.studentId || s.id,
    name: s.name,
    phone: s.phone,
    regNo: s.regNo,
    iat: s.iat || s.createdAt || Date.now(),
    exp: s.exp || s.expiresAt || (Date.now() + STUDENT_ABSOLUTE_EXPIRY_MS),
    role: s.role,
    sessionId: s.sessionId,
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
  };
}

