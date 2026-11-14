import fs from 'fs';
import path from 'path';
import os from 'os';
import { Workshop, WorkshopSession, WorkshopStatus } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';
import { getSessionPermanentQrToken } from '@/lib/qrSecurity';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_STORAGE_FILE = path.join(DATA_DIR, 'workshops.json');
const TMP_STORAGE_FILE = path.join(os.tmpdir(), 'technosavvys-workshops.json');

declare global {
  // eslint-disable-next-line no-var
  var __technosavvysWorkshops: Workshop[] | undefined;
}

let memoryWorkshops: Workshop[] = global.__technosavvysWorkshops || [];
if (!global.__technosavvysWorkshops) {
  global.__technosavvysWorkshops = memoryWorkshops;
}

function safeLoadFromFile(): Workshop[] {
  const mergedMap = new Map<string, Workshop>();

  // 1. Try local data file
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const w of parsed) {
          if (w && w.id) mergedMap.set(w.id, w);
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
        for (const w of parsed) {
          if (w && w.id) mergedMap.set(w.id, w);
        }
      }
    }
  } catch {}

  return Array.from(mergedMap.values());
}

function safeSaveToFile(workshops: Workshop[]) {
  // Try /tmp directory first (always writable in Vercel Lambdas)
  try {
    fs.writeFileSync(TMP_STORAGE_FILE, JSON.stringify(workshops, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[workshopStore] Warning writing to /tmp:', err);
  }

  // Try local data directory if writable
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(workshops, null, 2), 'utf-8');
  } catch (err) {
    // Expected on read-only serverless filesystems
  }
}

function initMemory() {
  if (!memoryWorkshops || memoryWorkshops.length === 0) {
    const loaded = safeLoadFromFile();
    memoryWorkshops.length = 0;
    memoryWorkshops.push(...loaded);
    global.__technosavvysWorkshops = memoryWorkshops;
  }
}

/**
 * Fetch all workshops:
 * Single Source of Truth: Supabase PostgreSQL (if configured) -> Persistent Cache Fallback
 */
export async function getAllWorkshops(): Promise<Workshop[]> {
  initMemory();

  // Re-sync with file storage to capture cross-process / lambda persistence
  const fileWorkshops = safeLoadFromFile();
  for (const fw of fileWorkshops) {
    if (!memoryWorkshops.some((w) => w.id === fw.id)) {
      memoryWorkshops.push(fw);
    }
  }

  // 1. Hostinger / Remote MySQL Integration (Priority 1 if configured)
  if (isMySQLConfigured()) {
    try {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT w.*, 
                s.id as sess_id, s.session_title, s.date as sess_date, s.start_time, s.end_time, s.location as sess_location, s.status as sess_status
         FROM workshops w
         LEFT JOIN workshop_sessions s ON w.id = s.workshop_id
         ORDER BY w.created_at DESC`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const wsMap = new Map<string, Workshop>();
        for (const r of rows) {
          if (!wsMap.has(r.id)) {
            wsMap.set(r.id, {
              id: r.id,
              title: r.title,
              category: r.category,
              trainer: r.trainer,
              trainerRole: r.trainer_role || 'Senior Principal Instructor',
              date: r.date,
              time: r.time,
              duration: r.duration,
              location: r.location,
              capacity: r.capacity,
              price: Number(r.price) || 0,
              status: r.status,
              description: r.description || '',
              tags: typeof r.tags === 'string' && r.tags.startsWith('[') ? JSON.parse(r.tags) : ['Workshop'],
              enrolledCount: r.enrolled_count || 0,
              sessions: [],
            });
          }
          if (r.sess_id) {
            const ws = wsMap.get(r.id)!;
            if (!ws.sessions.some((s) => s.id === r.sess_id)) {
              ws.sessions.push({
                id: r.sess_id,
                workshopId: r.id,
                sessionTitle: r.session_title,
                date: r.sess_date,
                startTime: r.start_time,
                endTime: r.end_time,
                location: r.sess_location,
                status: r.sess_status,
                isActive: r.sess_status !== 'Completed' && r.sess_status !== 'Cancelled',
                qrToken: r.qr_token || getSessionPermanentQrToken(r.id, r.sess_id),
              });
            }
          }
        }
        for (const ws of wsMap.values()) {
          const idx = memoryWorkshops.findIndex((w) => w.id === ws.id);
          if (idx >= 0) memoryWorkshops[idx] = ws;
          else memoryWorkshops.unshift(ws);
        }
        global.__technosavvysWorkshops = memoryWorkshops;
        safeSaveToFile(memoryWorkshops);
        return memoryWorkshops;
      }
    } catch (err) {
      console.warn('[workshopStore] MySQL query error, falling back:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('workshops')
        .select(`
          id,
          code,
          title,
          category,
          trainer,
          trainer_role,
          capacity,
          price,
          description,
          tags,
          status,
          workshop_sessions (
            id,
            session_title,
            session_date,
            start_time,
            end_time,
            location,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const dbWorkshops: Workshop[] = data.map((row) => {
          const wsCode = row.code || row.id;
          const sessions: WorkshopSession[] = (row.workshop_sessions || []).map((s: any) => ({
            id: s.id,
            workshopId: wsCode,
            sessionTitle: s.session_title,
            date: s.session_date,
            startTime: s.start_time,
            endTime: s.end_time,
            location: s.location || 'Campus / Virtual Lab',
            status: s.status || 'Scheduled',
            isActive: s.status !== 'Completed' && s.status !== 'Cancelled',
            qrToken: getSessionPermanentQrToken(wsCode, s.id),
          }));

          return {
            id: wsCode,
            title: row.title,
            category: row.category as any,
            trainer: row.trainer,
            trainerRole: row.trainer_role || 'Lead Instructor',
            capacity: row.capacity || 100,
            price: Number(row.price) || 0,
            description: row.description || '',
            tags: row.tags || ['Workshop'],
            status: row.status as WorkshopStatus,
            date: sessions[0]?.date || new Date().toISOString().split('T')[0],
            time: sessions[0] ? `${sessions[0].startTime} - ${sessions[0].endTime}` : '10:00 AM - 05:00 PM',
            duration: '6 Hours',
            location: sessions[0]?.location || 'Campus / Virtual Lab',
            enrolledCount: 0,
            sessions: sessions.length > 0 ? sessions : [
              {
                id: `SESS-${wsCode}-1`,
                workshopId: wsCode,
                sessionTitle: `${row.title} - Main Session`,
                date: new Date().toISOString().split('T')[0],
                startTime: '10:00 AM',
                endTime: '05:00 PM',
                location: 'Campus / Virtual Lab',
                status: 'Scheduled',
                isActive: true,
                qrToken: getSessionPermanentQrToken(wsCode, `SESS-${wsCode}-1`),
              }
            ],
          };
        });

        // Merge DB workshops into memory, never wiping locally saved workshops
        for (const dbW of dbWorkshops) {
          const idx = memoryWorkshops.findIndex((w) => w.id === dbW.id);
          if (idx >= 0) {
            memoryWorkshops[idx] = dbW;
          } else {
            memoryWorkshops.unshift(dbW);
          }
        }
        global.__technosavvysWorkshops = memoryWorkshops;
        safeSaveToFile(memoryWorkshops);
      }
    } catch (err) {
      console.warn('[workshopStore] Supabase query failed, falling back to persistent store:', err);
    }
  }

  return memoryWorkshops;
}

/**
 * Save new or updated workshop to Supabase PostgreSQL & Persistent Cache
 */
export async function saveWorkshop(workshop: Workshop): Promise<Workshop> {
  initMemory();

  // 1. Persist to Hostinger / Remote MySQL first if configured
  if (isMySQLConfigured()) {
    const tagsStr = JSON.stringify(workshop.tags || ['Workshop']);
    await executeMySQLQuery(
      `INSERT INTO workshops (id, title, category, trainer, trainer_role, date, time, duration, location, capacity, price, status, description, tags, enrolled_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         title=VALUES(title), category=VALUES(category), trainer=VALUES(trainer), trainer_role=VALUES(trainer_role),
         date=VALUES(date), time=VALUES(time), duration=VALUES(duration), location=VALUES(location),
         capacity=VALUES(capacity), price=VALUES(price), status=VALUES(status), description=VALUES(description),
         tags=VALUES(tags), enrolled_count=VALUES(enrolled_count)`,
      [
        workshop.id,
        workshop.title,
        workshop.category,
        workshop.trainer,
        workshop.trainerRole || 'Senior Principal Instructor',
        workshop.date,
        workshop.time,
        workshop.duration,
        workshop.location,
        workshop.capacity,
        workshop.price,
        workshop.status,
        workshop.description || '',
        tagsStr,
        workshop.enrolledCount || 0,
      ]
    );

    if (Array.isArray(workshop.sessions)) {
      for (const s of workshop.sessions) {
        const qrToken = s.qrToken || getSessionPermanentQrToken(workshop.id, s.id);
        await executeMySQLQuery(
          `INSERT INTO workshop_sessions (id, workshop_id, session_title, date, start_time, end_time, location, status, qr_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             session_title=VALUES(session_title), date=VALUES(date), start_time=VALUES(start_time),
             end_time=VALUES(end_time), location=VALUES(location), status=VALUES(status), qr_token=VALUES(qr_token)`,
          [
            s.id,
            workshop.id,
            s.sessionTitle,
            s.date,
            s.startTime,
            s.endTime,
            s.location || 'Campus / Virtual Lab',
            s.status || 'Scheduled',
            qrToken,
          ]
        );
      }
    }
  }

  // 2. Update in-memory & file cache only after successful database write (or offline mode)
  const idx = memoryWorkshops.findIndex((w) => w.id === workshop.id);
  if (idx >= 0) {
    memoryWorkshops[idx] = workshop;
  } else {
    memoryWorkshops.unshift(workshop);
  }
  safeSaveToFile(memoryWorkshops);

  // 3. Persist to Supabase PostgreSQL if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();

      // Upsert workshop record
      const { data: wsRow, error: wsErr } = await supabase
        .from('workshops')
        .upsert(
          {
            code: workshop.id,
            title: workshop.title,
            category: workshop.category,
            trainer: workshop.trainer,
            trainer_role: workshop.trainerRole || 'Lead Instructor',
            capacity: workshop.capacity || 100,
            price: workshop.price || 0,
            description: workshop.description || '',
            tags: workshop.tags || ['Workshop'],
            status: workshop.status || 'Ongoing',
          },
          { onConflict: 'code' }
        )
        .select('id')
        .single();

      if (!wsErr && wsRow && Array.isArray(workshop.sessions)) {
        // Upsert workshop sessions
        for (const sess of workshop.sessions) {
          await supabase.from('workshop_sessions').upsert(
            {
              workshop_id: wsRow.id,
              session_title: sess.sessionTitle,
              session_date: sess.date || new Date().toISOString().split('T')[0],
              start_time: sess.startTime || '10:00:00',
              end_time: sess.endTime || '17:00:00',
              location: sess.location || 'Campus / Virtual Lab',
              status: sess.status || 'Scheduled',
            },
            { onConflict: 'workshop_id,session_title' }
          );
        }
      }
    } catch (err) {
      console.warn('[workshopStore] Failed saving to Supabase:', err);
    }
  }

  return workshop;
}

/**
 * Delete a workshop by code or id
 * Blanket 'all' deletion is strictly forbidden to prevent accidental catastrophic data loss.
 */
export async function deleteWorkshop(id: string): Promise<boolean> {
  if (!id || id === 'all') {
    throw new Error('Mass deletion via id="all" is strictly prohibited.');
  }

  initMemory();

  const initialCount = memoryWorkshops.length;
  memoryWorkshops = memoryWorkshops.filter((w) => w.id !== id);
  global.__technosavvysWorkshops = memoryWorkshops;
  safeSaveToFile(memoryWorkshops);

  if (isMySQLConfigured()) {
    try {
      await executeMySQLQuery(`DELETE FROM workshop_sessions WHERE workshop_id = ?`, [id]);
      await executeMySQLQuery(`DELETE FROM workshops WHERE id = ?`, [id]);
    } catch (err) {
      console.warn('[workshopStore] MySQL delete failed:', err);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('workshops').delete().eq('code', id);
      await supabase.from('workshops').delete().eq('id', id);
    } catch {}
  }

  return memoryWorkshops.length < initialCount;
}

