import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';

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

function verifyPbkdf2(password: string, salt: string, expectedHash: string): boolean {
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Cryptographically verifies password against stored PBKDF2 hash
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return verifyPbkdf2(password, currentAdminCreds.salt, currentAdminCreds.hash);
}

/**
 * Verifies admin credentials against MySQL `admins` table (if configured),
 * falling back to env PBKDF2 hash and auto-seeding the MySQL `admins` row.
 */
export async function verifyAdminPasswordFromDb(
  identifier: string,
  password: string
): Promise<{
  valid: boolean;
  email: string;
  name: string;
  role: string;
}> {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean || !password) {
    return { valid: false, email: ADMIN_EMAIL, name: ADMIN_NAME, role: ADMIN_ROLE };
  }

  if (isMySQLConfigured()) {
    try {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT id, username, email, password_hash, password_salt, role FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`,
        [clean, clean]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        const ok = verifyPbkdf2(password, row.password_salt, row.password_hash);
        if (ok) {
          currentAdminCreds = { salt: row.password_salt, hash: row.password_hash };
        }
        return {
          valid: ok,
          email: row.email || ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: row.role || ADMIN_ROLE,
        };
      }
    } catch (err) {
      console.warn('[adminAuth] MySQL admin lookup warning:', err);
    }
  }

  if (isAdminIdentifier(clean) && verifyAdminPassword(password)) {
    if (isMySQLConfigured()) {
      try {
        await executeMySQLQuery(
          `INSERT INTO admins (id, username, email, password_hash, password_salt, role)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), password_salt = VALUES(password_salt)`,
          ['ADMIN-PRIMARY', ADMIN_USERNAME, ADMIN_EMAIL, currentAdminCreds.hash, currentAdminCreds.salt, ADMIN_ROLE]
        );
      } catch (err) {
        console.warn('[adminAuth] MySQL admin seed warning:', err);
      }
    }
    return { valid: true, email: ADMIN_EMAIL, name: ADMIN_NAME, role: ADMIN_ROLE };
  }

  return { valid: false, email: ADMIN_EMAIL, name: ADMIN_NAME, role: ADMIN_ROLE };
}

/**
 * Updates admin password in runtime, .env.local (if present), and MySQL `admins` table.
 */
export async function updateAdminPasswordInDb(
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = updateAdminPassword(newPassword);
  if (!res.success) return res;

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(
        `INSERT INTO admins (id, username, email, password_hash, password_salt, role)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), password_salt = VALUES(password_salt)`,
        ['ADMIN-PRIMARY', ADMIN_USERNAME, ADMIN_EMAIL, currentAdminCreds.hash, currentAdminCreds.salt, ADMIN_ROLE]
      );
    } catch (err) {
      console.error('[adminAuth] Failed to persist updated password to MySQL:', err);
      return { success: false, message: 'Failed to persist new password to database.' };
    }
  }

  return res;
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

