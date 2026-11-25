/**
 * Browser-safe pure string normalization and privacy masking helpers.
 */

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function normalizeStudentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone || '';
  return `+91 ******${digits.slice(-4)}`;
}

export function normalizeIdentifier(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return normalizePhoneNumber(trimmed);
}
