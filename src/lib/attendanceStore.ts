import fs from 'fs';
import path from 'path';
import { AttendanceRecord, AttendanceStatus } from '@/types';
import { INITIAL_ATTENDANCE } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'attendance-records.json');

// In-memory cache synced with INITIAL_ATTENDANCE
let isInitialized = false;

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_FILE)) {
      // Seed with INITIAL_ATTENDANCE
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(INITIAL_ATTENDANCE, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[attendanceStore] File system access warning:', err);
  }
}

function loadFromFile(): AttendanceRecord[] {
  ensureDataFile();
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[attendanceStore] Read error, falling back to in-memory:', err);
  }
  return INITIAL_ATTENDANCE;
}

function saveToFile(records: AttendanceRecord[]) {
  ensureDataFile();
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[attendanceStore] Write error:', err);
  }
}

export function initAttendanceStore() {
  if (isInitialized) return;
  const records = loadFromFile();
  // Sync with INITIAL_ATTENDANCE without clearing existing items
  for (const rec of records) {
    if (!INITIAL_ATTENDANCE.some((a) => a.id === rec.id)) {
      INITIAL_ATTENDANCE.push(rec);
    }
  }
  isInitialized = true;
}

/**
 * Retrieve all attendance records, optionally filtered by workshopId or sessionId
 */
export async function getAllAttendanceRecords(filter?: {
  workshopId?: string;
  sessionId?: string;
}): Promise<AttendanceRecord[]> {
  initAttendanceStore();

  let records = [...INITIAL_ATTENDANCE];

  // Try querying Supabase if available
  try {
    const supabase = createAdminClient();
    const query = supabase.from('attendance').select('*');
    if (filter?.sessionId) {
      query.eq('session_id', filter.sessionId);
    } else if (filter?.workshopId) {
      query.eq('workshop_id', filter.workshopId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      for (const row of data) {
        const mapped: AttendanceRecord = {
          id: row.id,
          workshopId: row.workshop_id || filter?.workshopId || '',
          workshopTitle: row.workshop_title || 'Workshop',
          sessionId: row.session_id || filter?.sessionId || '',
          sessionTitle: row.session_title || 'Workshop Session',
          studentName: row.student_name || row.notes || 'Student',
          studentEmail: row.student_email || '',
          studentPhone: row.student_phone || '',
          studentCourse: row.student_course || 'Workshop Session',
          date: row.check_in_time ? row.check_in_time.split('T')[0] : new Date().toISOString().split('T')[0],
          time: row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          serverTimestamp: row.check_in_time || new Date().toISOString(),
          status: (row.status as AttendanceStatus) || 'PENDING_REVIEW',
          checkInMethod: (row.method as any) || 'QR Scan',
          notes: row.notes || '',
        };
        const idx = records.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) {
          records[idx] = mapped;
        } else {
          records.unshift(mapped);
        }
      }
    }
  } catch {
    // Offline fallback: records already contains INITIAL_ATTENDANCE
  }

  if (filter?.sessionId) {
    return records.filter((r) => r.sessionId === filter.sessionId);
  }
  if (filter?.workshopId) {
    const wsId = filter.workshopId;
    return records.filter(
      (r) =>
        r.workshopId === wsId ||
        (r.sessionId && r.sessionId.includes(wsId))
    );
  }

  return records;
}

/**
 * Save new attendance record into persistent store and memory
 */
export async function saveAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
  initAttendanceStore();

  // Add or update in memory
  const idx = INITIAL_ATTENDANCE.findIndex((a) => a.id === record.id);
  if (idx >= 0) {
    INITIAL_ATTENDANCE[idx] = record;
  } else {
    INITIAL_ATTENDANCE.unshift(record);
  }

  // Persist to local JSON file
  saveToFile(INITIAL_ATTENDANCE);

  // Try persisting to Supabase
  try {
    const supabase = createAdminClient();
    await supabase.from('attendance').upsert({
      id: record.id,
      workshop_id: record.workshopId,
      session_id: record.sessionId,
      student_name: record.studentName,
      student_email: record.studentEmail,
      student_phone: record.studentPhone,
      student_course: record.studentCourse,
      check_in_time: record.serverTimestamp || new Date().toISOString(),
      status: record.status,
      method: record.checkInMethod || 'QR Scan',
      notes: record.notes || 'Submitted via QR check-in',
    });
  } catch {
    // Supabase offline/mock fallback
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

  const record = INITIAL_ATTENDANCE.find((a) => a.id === id);
  if (!record) return null;

  record.status = status;
  saveToFile(INITIAL_ATTENDANCE);

  // Try updating in Supabase
  try {
    const supabase = createAdminClient();
    await supabase.from('attendance').update({ status }).eq('id', id);
  } catch {}

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
    const record = INITIAL_ATTENDANCE.find((a) => a.id === id);
    if (record) {
      record.status = status;
      count++;
    }
  }

  if (count > 0) {
    saveToFile(INITIAL_ATTENDANCE);
    try {
      const supabase = createAdminClient();
      await supabase.from('attendance').update({ status }).in('id', ids);
    } catch {}
  }

  return count;
}
