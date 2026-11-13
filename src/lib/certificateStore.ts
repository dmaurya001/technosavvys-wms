import fs from 'fs';
import path from 'path';
import os from 'os';
import { Certificate } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';

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

  // 1. Try local data file
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8').replace(/^\uFEFF/, '');
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
      const raw = fs.readFileSync(TMP_STORAGE_FILE, 'utf-8').replace(/^\uFEFF/, '');
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

  // 1. Hostinger / Remote MySQL Integration (Priority 1 if configured)
  if (isMySQLConfigured()) {
    try {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT * FROM certificates ORDER BY created_at DESC`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          const mapped: Certificate = {
            id: r.certificate_no,
            certificateNo: r.certificate_no,
            studentId: r.student_id || `STU-${r.certificate_no}`,
            studentName: r.student_name,
            studentEmail: r.student_email,
            studentPhone: r.student_phone || '',
            workshopId: r.workshop_id,
            workshopTitle: r.workshop_title,
            trainer: r.trainer_name || 'Lead Instructor',
            issueDate: r.issue_date,
            grade: (r.grade as any) || 'Distinction',
            status: 'Issued',
            score: r.score ? Number(r.score.toString().replace('%', '')) : 95,
          };
          const idx = records.findIndex(
            (c) => c.certificateNo === mapped.certificateNo || c.id === mapped.id
          );
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
      console.warn('[certificateStore] MySQL query error, falling back:', err);
    }
  }

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
    (c) =>
      c.id === certificate.id ||
      c.certificateNo === certificate.certificateNo ||
      (Boolean(certificate.workshopId) &&
        Boolean(certificate.studentEmail) &&
        c.workshopId === certificate.workshopId &&
        c.studentEmail?.toLowerCase() === certificate.studentEmail?.toLowerCase()) ||
      (Boolean(certificate.workshopId) &&
        Boolean(certificate.studentId) &&
        c.workshopId === certificate.workshopId &&
        c.studentId === certificate.studentId)
  );
  if (idx >= 0) {
    // Preserve initial certificate number if already assigned
    certificate.certificateNo = memoryCertificates[idx].certificateNo || certificate.certificateNo;
    certificate.id = memoryCertificates[idx].id || certificate.id;
    memoryCertificates[idx] = certificate;
  } else {
    memoryCertificates.unshift(certificate);
  }

  global.__technosavvysCertificates = memoryCertificates;
  safeSaveToFile(memoryCertificates);

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(
        `INSERT INTO certificates 
         (certificate_no, student_name, student_email, student_phone, student_course, workshop_id, workshop_title, issue_date, trainer_name, grade, verification_code, score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           student_name=VALUES(student_name), workshop_title=VALUES(workshop_title), grade=VALUES(grade), score=VALUES(score)`,
        [
          certificate.certificateNo || certificate.id,
          certificate.studentName,
          certificate.studentEmail?.toLowerCase() || '',
          certificate.studentPhone || '',
          'ADCA',
          certificate.workshopId || '',
          certificate.workshopTitle || 'Workshop',
          certificate.issueDate || new Date().toISOString().split('T')[0],
          certificate.trainer || 'Lead Instructor',
          certificate.grade || 'Distinction',
          `VRF-${Date.now().toString().slice(-6)}`,
          String(certificate.score || 95),
        ]
      );
    } catch (err) {
      console.warn('[certificateStore] MySQL save certificate error:', err);
    }
  }

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

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(`DELETE FROM certificates WHERE certificate_no = ?`, [certificateId]);
    } catch (err) {
      console.warn('[certificateStore] MySQL delete certificate error:', err);
    }
  }

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

/**
 * Delete unpublished certificates for a workshop during cascade delete
 * Never deletes published certificates
 */
export async function deleteUnpublishedCertificatesByWorkshop(workshopId: string): Promise<Certificate[]> {
  initCertificateStore();

  const toDelete = memoryCertificates.filter(
    (c) => (c.workshopId === workshopId || c.workshopId?.includes(workshopId)) && c.status !== 'Issued'
  );

  if (toDelete.length === 0) return [];

  memoryCertificates = memoryCertificates.filter(
    (c) => !toDelete.some((d) => d.id === c.id)
  );

  global.__technosavvysCertificates = memoryCertificates;
  safeSaveToFile(memoryCertificates);

  return toDelete;
}

/**
 * Delete ALL certificates (both published & draft) and their physical PDF files
 * when a workshop is explicitly deleted by the user.
 */
export async function deleteAllCertificatesByWorkshop(workshopId: string): Promise<Certificate[]> {
  initCertificateStore();

  const toDelete = memoryCertificates.filter(
    (c) => c.workshopId === workshopId || c.workshopId?.includes(workshopId)
  );

  if (toDelete.length === 0) return [];

  // Remove physical certificate PDF files
  const PDF_DIR = path.join(process.cwd(), 'data', 'pdf-certificates');
  const TMP_PDF_DIR = path.join(os.tmpdir(), 'technosavvys-pdf-certificates');

  for (const cert of toDelete) {
    const candidates = [
      `${cert.id}.pdf`,
      cert.fileName,
      `${cert.certificateNo}.pdf`,
    ].filter(Boolean) as string[];

    for (const fn of candidates) {
      try {
        const localP = path.join(PDF_DIR, fn);
        if (fs.existsSync(localP)) fs.unlinkSync(localP);
      } catch {}

      try {
        const tmpP = path.join(TMP_PDF_DIR, fn);
        if (fs.existsSync(tmpP)) fs.unlinkSync(tmpP);
      } catch {}
    }
  }

  // Remove from in-memory and local storage
  memoryCertificates = memoryCertificates.filter(
    (c) => !toDelete.some((d) => d.id === c.id)
  );

  global.__technosavvysCertificates = memoryCertificates;
  safeSaveToFile(memoryCertificates);

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(`DELETE FROM certificates WHERE workshop_id = ?`, [workshopId]);
    } catch (err) {
      console.warn('[certificateStore] MySQL delete certificates error:', err);
    }
  }

  // Remove from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const ids = toDelete.map((c) => c.id);
      await supabase.from('certificates').delete().in('id', ids);
    } catch (err) {
      console.warn('[certificateStore] Supabase delete warning:', err);
    }
  }

  return toDelete;
}

