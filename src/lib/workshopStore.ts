import fs from 'fs';
import path from 'path';
import os from 'os';
import { Workshop, WorkshopSession, WorkshopStatus } from '@/types';
import { INITIAL_WORKSHOPS } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
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

  return INITIAL_WORKSHOPS;
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

        // Merge with memory/initial to avoid dropping any active local seeds
        for (const dbWs of dbWorkshops) {
          const idx = memoryWorkshops.findIndex((w) => w.id === dbWs.id);
          if (idx >= 0) {
            memoryWorkshops[idx] = dbWs;
          } else {
            memoryWorkshops.unshift(dbWs);
          }
        }

        safeSaveToFile(memoryWorkshops);
        return memoryWorkshops;
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

  // 1. Update in-memory & file cache
  const idx = memoryWorkshops.findIndex((w) => w.id === workshop.id);
  if (idx >= 0) {
    memoryWorkshops[idx] = workshop;
  } else {
    memoryWorkshops.unshift(workshop);
  }
  safeSaveToFile(memoryWorkshops);

  // 2. Persist to Supabase PostgreSQL if configured
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
 */
export async function deleteWorkshop(id: string): Promise<boolean> {
  initMemory();

  if (id === 'all') {
    memoryWorkshops.length = 0;
    safeSaveToFile(memoryWorkshops);

    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        await supabase.from('workshops').delete().neq('code', '__PRESERVE_NONE__');
      } catch {}
    }
    return true;
  }

  const initialCount = memoryWorkshops.length;
  memoryWorkshops = memoryWorkshops.filter((w) => w.id !== id);
  global.__technosavvysWorkshops = memoryWorkshops;
  safeSaveToFile(memoryWorkshops);

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      await supabase.from('workshops').delete().eq('code', id);
    } catch {}
  }

  return memoryWorkshops.length < initialCount;
}
