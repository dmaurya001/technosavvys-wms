import crypto from 'crypto';

const QR_SECRET =
  process.env.QR_TOKEN_SECRET ||
  'technosavvys-dynamic-qr-rotation-key-2026';

/**
 * Generates a permanent, unique, and cryptographically secure QR token
 * for a specific workshop session. The token remains unchanged throughout the session.
 */
export function getSessionPermanentQrToken(workshopId: string, sessionId: string): string {
  const hash = crypto
    .createHmac('sha256', QR_SECRET)
    .update(`session:${workshopId}:${sessionId}`)
    .digest('hex');
  return `ts_qr_${hash.substring(0, 32)}`;
}

/**
 * Validates that the provided QR token belongs strictly to this workshop session.
 */
export function verifySessionPermanentQrToken(
  workshopId: string,
  sessionId: string,
  providedToken: string
): boolean {
  if (!providedToken || typeof providedToken !== 'string') return false;
  const expectedToken = getSessionPermanentQrToken(workshopId, sessionId);

  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken);

  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export interface QrTokenPayload {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

/**
 * Legacy compatibility helper for rotating token interface
 */
export function generateRotatingQrToken(sessionId: string, durationSeconds: number = 45): {
  token: string;
  expiresAt: number;
} {
  return {
    token: getSessionPermanentQrToken('default', sessionId),
    expiresAt: Date.now() + 86400000,
  };
}

/**
 * Legacy compatibility helper for token verification
 */
export function verifyRotatingQrToken(
  sessionId: string,
  token: string
): { valid: boolean; error?: string; payload?: QrTokenPayload } {
  if (!token) {
    return { valid: false, error: 'Missing QR security token.' };
  }
  const isValid = verifySessionPermanentQrToken('default', sessionId, token);

  return {
    valid: isValid,
    error: isValid ? undefined : 'QR token is invalid for this session.',
  };
}

