import fs from 'fs';
import path from 'path';
import os from 'os';
import { AttendanceRecord, AttendanceStatus } from '@/types';
import { INITIAL_ATTENDANCE } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_STORAGE_FILE = path.join(DATA_DIR, 'attendance-records.json');
const TMP_STORAGE_FILE = path.join(os.tmpdir(), 'technosavvys-attendance.json');

declare global {
  // eslint-disable-next-line no-var
  var __technosavvysAttendance: AttendanceRecord[] | undefined;
}

let memoryAttendance: AttendanceRecord[] = global.__technosavvysAttendance || [];
if (!global.__technosavvysAttendance) {
  global.__technosavvysAttendance = memoryAttendance;
}

function safeLoadFromFile(): AttendanceRecord[] {
  // 1. Try local data file
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // 2. Try /tmp file (Vercel Serverless environment)
  try {
    if (fs.existsSync(TMP_STORAGE_FILE)) {
      const raw = fs.readFileSync(TMP_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return INITIAL_ATTENDANCE;
}

function safeSaveToFile(records: AttendanceRecord[]) {
  // Try /tmp directory first (always writable in Vercel Lambdas)
  try {
    fs.writeFileSync(TMP_STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[attendanceStore] Warning writing to /tmp:', err);
  }

  // Try local data directory if writable
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    // Expected on read-only serverless filesystems
  }
}

export function initAttendanceStore() {
  if (!memoryAttendance || memoryAttendance.length === 0) {
    const loaded = safeLoadFromFile();
    memoryAttendance.length = 0;
    memoryAttendance.push(...loaded);

    for (const initRec of INITIAL_ATTENDANCE) {
      if (!memoryAttendance.some((a) => a.id === initRec.id)) {
        memoryAttendance.push(initRec);
      }
    }
    global.__technosavvysAttendance = memoryAttendance;
  }
}

/**
 * Retrieve all attendance records:
 * Single Source of Truth: Supabase PostgreSQL (if configured) -> Persistent Cache Fallback
 */
export async function getAllAttendanceRecords(filter?: {
  workshopId?: string;
  sessionId?: string;
}): Promise<AttendanceRecord[]> {
  initAttendanceStore();

  let records = [...memoryAttendance];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          check_in_method,
          check_in_time,
          notes,
          workshop_sessions (
            id,
            session_title,
            session_date,
            workshops (
              id,
              code,
              title
            )
          ),
          students (
            id,
            full_name,
            email,
            phone,
            registration_no,
            college,
            batch
          )
        `)
        .order('check_in_time', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        for (const row of data) {
          const sess = (row as any).workshop_sessions;
          const ws = sess?.workshops;
          const stu = (row as any).students;

          const wsCode = ws?.code || ws?.id || '';
          const sessId = sess?.id || '';
          const checkInTime = row.check_in_time || new Date().toISOString();

          const mapped: AttendanceRecord = {
            id: row.id,
            workshopId: wsCode,
            workshopTitle: ws?.title || 'Workshop',
            sessionId: sessId,
            sessionTitle: sess?.session_title || 'Session 1: Main Workshop',
            studentId: stu?.id,
            studentName: stu?.full_name || 'Student',
            studentEmail: stu?.email || '',
            studentPhone: stu?.phone || '',
            studentCourse: stu?.college || stu?.batch || 'Web Dev',
            studentRegNo: stu?.registration_no,
            date: checkInTime.split('T')[0],
            time: new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            serverTimestamp: checkInTime,
            status: (row.status as AttendanceStatus) || 'PENDING_REVIEW',
            checkInMethod: (row.check_in_method as any) || 'QR Scan',
            notes: row.notes || 'Verified QR check-in',
          };

          const idx = records.findIndex((r) => r.id === mapped.id || (r.studentEmail === mapped.studentEmail && r.sessionId === mapped.sessionId));
          if (idx >= 0) {
            records[idx] = mapped;
          } else {
            records.unshift(mapped);
          }
        }

        memoryAttendance = records;
        global.__technosavvysAttendance = records;
        safeSaveToFile(records);
      }
    } catch (err) {
      console.warn('[attendanceStore] Supabase query warning, using persistent store:', err);
    }
  }

  // Apply filters if provided
  if (filter?.sessionId) {
    const sId = filter.sessionId;
    return records.filter((r) => r.sessionId === sId || (filter.workshopId && r.workshopId === filter.workshopId));
  }

  if (filter?.workshopId) {
    const wsId = filter.workshopId;
    return records.filter(
      (r) =>
        r.workshopId === wsId ||
        (r.sessionId && r.sessionId.includes(wsId)) ||
        (r.workshopTitle && r.workshopTitle.toLowerCase().includes(wsId.toLowerCase()))
    );
  }

  return records;
}

/**
 * Save new attendance record into persistent store and Supabase
 */
export async function saveAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
  initAttendanceStore();

  // 1. Add or update in memory cache
  const idx = memoryAttendance.findIndex((a) => a.id === record.id);
  if (idx >= 0) {
    memoryAttendance[idx] = record;
  } else {
    memoryAttendance.unshift(record);
  }
  global.__technosavvysAttendance = memoryAttendance;
  safeSaveToFile(memoryAttendance);

  // 2. Persist to Supabase PostgreSQL if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();

      // Find or create student
      let studentUuid: string | null = null;
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .or(`email.eq.${record.studentEmail},phone.eq.${record.studentPhone}`)
        .maybeSingle();

      if (existingStudent?.id) {
        studentUuid = existingStudent.id;
      } else {
        const { data: newStu } = await supabase
          .from('students')
          .insert({
            full_name: record.studentName,
            email: record.studentEmail,
            phone: record.studentPhone,
            registration_no: record.studentRegNo || `TS-${Date.now().toString().slice(-4)}`,
            college: record.studentCourse || 'Web Dev',
            batch: 'Batch 2026',
          })
          .select('id')
          .single();
        if (newStu?.id) studentUuid = newStu.id;
      }

      // Find workshop session UUID
      let sessionUuid: string | null = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.sessionId);
      if (isUuid) {
        sessionUuid = record.sessionId;
      } else {
        const { data: sessRow } = await supabase
          .from('workshop_sessions')
          .select('id')
          .eq('session_title', record.sessionTitle)
          .maybeSingle();
        if (sessRow?.id) {
          sessionUuid = sessRow.id;
        }
      }

      // Upsert into attendance if relations resolved
      if (sessionUuid && studentUuid) {
        await supabase.from('attendance').upsert(
          {
            session_id: sessionUuid,
            student_id: studentUuid,
            status: record.status || 'PENDING_REVIEW',
            check_in_method: record.checkInMethod || 'QR Scan',
            check_in_time: record.serverTimestamp || new Date().toISOString(),
            notes: record.notes || 'Verified Permanent Session QR. Awaiting Admin Approval.',
          },
          { onConflict: 'session_id,student_id' }
        );
      }
    } catch (err) {
      console.warn('[attendanceStore] Supabase save warning:', err);
    }
  }

  return record;
}

/**
 * Update attendance status for a record (APPROVED, REJECTED, PENDING_REVIEW)
 */
export async function updateAttendanceStatusInStore(
  id: string,
  status: AttendanceStatus
): Promise<AttendanceRecord | null> {
  initAttendanceStore();

  const record = memoryAttendance.find((a) => a.id === id);
  if (!record) return null;

  record.status = status;
  global.__technosavvysAttendance = memoryAttendance;
  safeSaveToFile(memoryAttendance);

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('attendance').update({ status }).eq('id', id);
    } catch {}
  }

  return record;
}

/**
 * Bulk update attendance status
 */
export async function bulkUpdateAttendanceStatusInStore(
  ids: string[],
  status: AttendanceStatus
): Promise<number> {
  initAttendanceStore();

  let count = 0;
  for (const id of ids) {
    const record = memoryAttendance.find((a) => a.id === id);
    if (record) {
      record.status = status;
      count++;
    }
  }

  if (count > 0) {
    global.__technosavvysAttendance = memoryAttendance;
    safeSaveToFile(memoryAttendance);

    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        await supabase.from('attendance').update({ status }).in('id', ids);
      } catch {}
    }
  }

  return count;
}
