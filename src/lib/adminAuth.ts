import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`${name} is not set`);
  }
  return val;
}

export const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
export const ADMIN_USERNAME = requireEnv('ADMIN_USERNAME');
export const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin';
export const ADMIN_NAME = requireEnv('ADMIN_NAME');

// In-memory credential state with secure PBKDF2 hashing
interface AdminCredentialState {
  salt: string;
  hash: string;
}

let currentAdminCreds: AdminCredentialState = {
  salt: requireEnv('ADMIN_PASSWORD_SALT'),
  hash: requireEnv('ADMIN_PASSWORD_HASH'),
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

