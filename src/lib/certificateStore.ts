import fs from 'fs';
import path from 'path';
import os from 'os';
import { Certificate } from '@/types';
import { INITIAL_CERTIFICATES } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_STORAGE_FILE = path.join(DATA_DIR, 'certificates.json');
const TMP_STORAGE_FILE = path.join(os.tmpdir(), 'technosavvys-certificates.json');

declare global {
  // eslint-disable-next-line no-var
  var __technosavvysCertificates: Certificate[] | undefined;
}

let memoryCertificates: Certificate[] = global.__technosavvysCertificates || [];
if (!global.__technosavvysCertificates) {
  global.__technosavvysCertificates = memoryCertificates;
}

function safeLoadFromFile(): Certificate[] {
  const mergedMap = new Map<string, Certificate>();

  // 1. Initial seed certificates
  for (const initCert of INITIAL_CERTIFICATES) {
    mergedMap.set(initCert.id, initCert);
  }

  // 2. Try local data file
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (c && c.id) mergedMap.set(c.id, c);
        }
      }
    }
  } catch {}

  // 3. Try /tmp file (Vercel Serverless environment)
  try {
    if (fs.existsSync(TMP_STORAGE_FILE)) {
      const raw = fs.readFileSync(TMP_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (c && c.id) mergedMap.set(c.id, c);
        }
      }
    }
  } catch {}

  return Array.from(mergedMap.values());
}

function safeSaveToFile(certificates: Certificate[]) {
  // Try /tmp directory first (always writable in Vercel Lambdas)
  try {
    fs.writeFileSync(TMP_STORAGE_FILE, JSON.stringify(certificates, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[certificateStore] Warning writing to /tmp:', err);
  }

  // Try local data directory if writable
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(certificates, null, 2), 'utf-8');
  } catch (err) {
    // Expected on read-only serverless filesystems
  }
}

export function initCertificateStore() {
  if (!memoryCertificates || memoryCertificates.length === 0) {
    const loaded = safeLoadFromFile();
    memoryCertificates.length = 0;
    memoryCertificates.push(...loaded);
    global.__technosavvysCertificates = memoryCertificates;
  }
}

/**
 * Retrieve all certificates with optional filtering by workshopId or studentId
 */
export async function getAllCertificates(filter?: {
  workshopId?: string;
  studentId?: string;
}): Promise<Certificate[]> {
  initCertificateStore();
  let records = [...memoryCertificates];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          certificate_no,
          student_id,
          workshop_id,
          trainer_name,
          issue_date,
          grade,
          status,
          score,
          storage_path,
          file_name,
          workshops (
            id,
            code,
            title,
            trainer
          ),
          students (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        for (const row of data) {
          const ws = (row as any).workshops;
          const stu = (row as any).students;

          const mapped: Certificate = {
            id: row.id,
            certificateNo: row.certificate_no,
            studentId: row.student_id,
            studentName: stu?.full_name || 'Participant',
            studentEmail: stu?.email || '',
            workshopId: ws?.code || row.workshop_id,
            workshopTitle: ws?.title || 'Technical Workshop',
            trainer: row.trainer_name || ws?.trainer || 'Lead Instructor',
            issueDate: row.issue_date,
            grade: row.grade as any || 'Distinction',
            status: row.status as any || 'Issued',
            score: Number(row.score) || 95,
            storagePath: row.storage_path,
            fileName: row.file_name,
          };

          const idx = records.findIndex((c) => c.id === mapped.id || c.certificateNo === mapped.certificateNo);
          if (idx >= 0) {
            records[idx] = mapped;
          } else {
            records.unshift(mapped);
          }
        }

        memoryCertificates = records;
        global.__technosavvysCertificates = memoryCertificates;
        safeSaveToFile(records);
      }
    } catch (err) {
      console.warn('[certificateStore] Supabase query warning:', err);
    }
  }

  if (filter?.workshopId) {
    const wsId = filter.workshopId;
    records = records.filter((c) => c.workshopId === wsId || c.workshopId?.includes(wsId));
  }

  if (filter?.studentId) {
    const sId = filter.studentId;
    records = records.filter((c) => c.studentId === sId);
  }

  return records;
}

/**
 * Save single certificate into persistent storage
 */
export async function saveCertificate(certificate: Certificate): Promise<Certificate> {
  initCertificateStore();

  const idx = memoryCertificates.findIndex(
    (c) => c.id === certificate.id || c.certificateNo === certificate.certificateNo
  );
  if (idx >= 0) {
    memoryCertificates[idx] = certificate;
  } else {
    memoryCertificates.unshift(certificate);
  }

  global.__technosavvysCertificates = memoryCertificates;
  safeSaveToFile(memoryCertificates);

  return certificate;
}

/**
 * Delete a certificate with explicit admin confirmation protection
 */
export async function deleteCertificate(
  certificateId: string,
  explicitAdminConfirmed: boolean
): Promise<{ success: boolean; message: string }> {
  if (!explicitAdminConfirmed) {
    return {
      success: false,
      message: 'Explicit administrator confirmation is strictly required to delete a published certificate.',
    };
  }

  initCertificateStore();
  const initialLength = memoryCertificates.length;
  memoryCertificates = memoryCertificates.filter((c) => c.id !== certificateId);
  global.__technosavvysCertificates = memoryCertificates;
  safeSaveToFile(memoryCertificates);

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('certificates').delete().eq('id', certificateId);
    } catch {}
  }

  const deleted = memoryCertificates.length < initialLength;
  return {
    success: deleted,
    message: deleted
      ? 'Certificate successfully deleted from database with admin confirmation.'
      : 'Certificate not found in registry.',
  };
}
