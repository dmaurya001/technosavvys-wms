import fs from 'fs';
import path from 'path';
import os from 'os';
import { AttendanceRecord, AttendanceStatus } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';

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
  const mergedMap = new Map<string, AttendanceRecord>();

  // 1. Try local data file
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const r of parsed) {
          if (r && r.id) mergedMap.set(r.id, r);
        }
      }
    }
  } catch {}

  // 2. Try /tmp file (Vercel Serverless environment)
  try {
    if (fs.existsSync(TMP_STORAGE_FILE)) {
      const raw = fs.readFileSync(TMP_STORAGE_FILE, 'utf-8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const r of parsed) {
          if (r && r.id) mergedMap.set(r.id, r);
        }
      }
    }
  } catch {}

  return Array.from(mergedMap.values());
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

  // 1. Hostinger / Remote MySQL Integration (Priority 1 if configured)
  if (isMySQLConfigured()) {
    try {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT * FROM attendance_records ORDER BY created_at DESC`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          const mapped: AttendanceRecord = {
            id: r.id,
            workshopId: r.workshop_id,
            workshopTitle: r.workshop_title,
            sessionId: r.session_id,
            sessionTitle: r.session_title,
            studentId: r.student_id,
            studentName: r.student_name,
            studentEmail: r.student_email,
            studentPhone: r.student_phone,
            studentCourse: r.student_course,
            date: r.date,
            time: r.time,
            serverTimestamp: r.server_timestamp,
            status: r.status as AttendanceStatus,
            checkInMethod: r.check_in_method as any,
            notes: r.notes || '',
          };
          const idx = records.findIndex(
            (rec) =>
              rec.id === mapped.id ||
              (rec.studentEmail === mapped.studentEmail && rec.sessionId === mapped.sessionId)
          );
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
      console.warn('[attendanceStore] MySQL query failed, falling back:', err);
    }
  }

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
  if (filter?.sessionId && filter?.workshopId) {
    const sId = filter.sessionId;
    const wsId = filter.workshopId;
    return records.filter(
      (r) =>
        r.sessionId === sId ||
        r.workshopId === wsId ||
        (r.sessionId && (r.sessionId === wsId || r.sessionId.includes(wsId))) ||
        (r.workshopTitle && filter.workshopId && r.workshopTitle.toLowerCase().includes(filter.workshopId.toLowerCase()))
    );
  }

  if (filter?.sessionId) {
    const sId = filter.sessionId;
    return records.filter(
      (r) =>
        r.sessionId === sId ||
        (r.sessionId && r.sessionId.includes(sId)) ||
        (filter.workshopId && r.workshopId === filter.workshopId)
    );
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

  // 1. Persist to Hostinger / Remote MySQL if configured (Must succeed before in-memory write)
  if (isMySQLConfigured()) {
    await executeMySQLQuery(
      `INSERT INTO attendance_records 
       (id, workshop_id, workshop_title, session_id, session_title, student_id, student_name, student_email, student_phone, student_course, date, time, server_timestamp, status, check_in_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status=VALUES(status), notes=VALUES(notes), server_timestamp=VALUES(server_timestamp)`,
      [
        record.id,
        record.workshopId,
        record.workshopTitle,
        record.sessionId,
        record.sessionTitle,
        record.studentId || null,
        record.studentName,
        record.studentEmail,
        record.studentPhone,
        record.studentCourse || 'ADCA',
        record.date,
        record.time,
        record.serverTimestamp,
        record.status || 'PENDING_REVIEW',
        record.checkInMethod || 'QR Scan',
        record.notes || '',
      ]
    );
  }

  // 2. Add or update in-memory cache and file storage only after MySQL insert succeeds
  const idx = memoryAttendance.findIndex((a) => a.id === record.id);
  if (idx >= 0) {
    memoryAttendance[idx] = record;
  } else {
    memoryAttendance.unshift(record);
  }
  global.__technosavvysAttendance = memoryAttendance;
  safeSaveToFile(memoryAttendance);

  // 3. Persist to Supabase PostgreSQL if configured
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

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(`UPDATE attendance_records SET status = ? WHERE id = ?`, [status, id]);
    } catch (err) {
      console.warn('[attendanceStore] MySQL status update failed:', err);
    }
  }

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

    if (isMySQLConfigured()) {
      try {
        const placeholders = ids.map(() => '?').join(',');
        await executeMySQLQuery(`UPDATE attendance_records SET status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
      } catch (err) {
        console.warn('[attendanceStore] MySQL bulk update failed:', err);
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        await supabase.from('attendance').update({ status }).in('id', ids);
      } catch {}
    }
  }

  return count;
}

/**
 * Cascade delete attendance records by workshop ID
 */
export async function deleteAttendanceByWorkshop(workshopId: string): Promise<AttendanceRecord[]> {
  initAttendanceStore();

  const toDelete = memoryAttendance.filter(
    (a) => a.workshopId === workshopId || (a.sessionId && a.sessionId.includes(workshopId))
  );

  if (toDelete.length === 0) return [];

  memoryAttendance = memoryAttendance.filter(
    (a) => a.workshopId !== workshopId && (!a.sessionId || !a.sessionId.includes(workshopId))
  );

  global.__technosavvysAttendance = memoryAttendance;
  safeSaveToFile(memoryAttendance);

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(`DELETE FROM attendance_records WHERE workshop_id = ?`, [workshopId]);
    } catch (err) {
      console.warn('[attendanceStore] MySQL delete failed:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const deleteIds = toDelete.map((a) => a.id);
      await supabase.from('attendance').delete().in('id', deleteIds);
    } catch (err) {
      console.warn('[attendanceStore] Cascade Supabase delete error:', err);
    }
  }

  return toDelete;
}

