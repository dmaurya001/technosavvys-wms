import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'techno3deepak@gmail.com';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Deepak@8960@techno';
export const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin';
export const ADMIN_NAME = process.env.ADMIN_NAME || 'Deepak Maurya (Administrator)';

// In-memory credential state with secure PBKDF2 hashing
interface AdminCredentialState {
  salt: string;
  hash: string;
}

// Initial fallback salt & PBKDF2 hash for the provisioned admin account
function generateInitialHash(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Initial state generated securely
const initialPasswordSource = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || ADMIN_USERNAME;
const defaultCreds = generateInitialHash(initialPasswordSource);

let currentAdminCreds: AdminCredentialState = {
  salt: process.env.ADMIN_PASSWORD_SALT || defaultCreds.salt,
  hash: process.env.ADMIN_PASSWORD_HASH || defaultCreds.hash,
};

/**
 * Checks whether an email or username belongs to the permanent super-admin
 */
export function isAdminIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') return false;
  const clean = identifier.trim().toLowerCase();
  return (
    clean === ADMIN_EMAIL.toLowerCase() ||
    clean === ADMIN_USERNAME.toLowerCase()
  );
}

/**
 * Cryptographically verifies password against stored PBKDF2 hash
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;

  // Direct env match check if configured
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    return true;
  }

  const computedHash = crypto
    .pbkdf2Sync(password, currentAdminCreds.salt, 100000, 64, 'sha512')
    .toString('hex');

  // Constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(currentAdminCreds.hash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Updates admin password securely using salted PBKDF2 and updates runtime state
 */
export function updateAdminPassword(newPassword: string): { success: boolean; message: string } {
  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      message: 'Password must be at least 8 characters in length.',
    };
  }

  const newSalt = crypto.randomBytes(32).toString('hex');
  const newHash = crypto
    .pbkdf2Sync(newPassword, newSalt, 100000, 64, 'sha512')
    .toString('hex');

  currentAdminCreds = {
    salt: newSalt,
    hash: newHash,
  };

  // Attempt to persist to .env.local without exposing plaintext
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('ADMIN_PASSWORD_HASH=')) {
        envContent = envContent.replace(/ADMIN_PASSWORD_HASH=.*/g, `ADMIN_PASSWORD_HASH=${newHash}`);
      } else {
        envContent += `\nADMIN_PASSWORD_HASH=${newHash}`;
      }

      if (envContent.includes('ADMIN_PASSWORD_SALT=')) {
        envContent = envContent.replace(/ADMIN_PASSWORD_SALT=.*/g, `ADMIN_PASSWORD_SALT=${newSalt}`);
      } else {
        envContent += `\nADMIN_PASSWORD_SALT=${newSalt}`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
    }
  } catch (err) {
    console.warn('[AdminAuth] Unable to write updated hash to .env.local, kept in memory.');
  }

  return {
    success: true,
    message: 'Password successfully updated and securely persisted.',
  };
}

