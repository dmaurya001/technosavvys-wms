import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import { getAllWorkshops } from '@/lib/workshopStore';
import { getAllAttendanceRecords } from '@/lib/attendanceStore';
import { getAllCertificates } from '@/lib/certificateStore';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function sqlEscape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${str}'`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request, 'teacher');
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'sql' ? 'sql' : 'json';

    const [workshops, attendance, certificates] = await Promise.all([
      getAllWorkshops(),
      getAllAttendanceRecords(),
      getAllCertificates(),
    ]);

    let students: any[] = [];
    if (isMySQLConfigured()) {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT id, name, email, phone, course, college, year, total_attended, created_at FROM students ORDER BY created_at DESC`
      );
      if (Array.isArray(rows)) students = rows;
    }

    await logAuditEvent({
      action: 'EXPORT_DB_BACKUP',
      entityType: 'Security',
      details: {
        format,
        by: auth.session.email,
        counts: {
          workshops: workshops.length,
          attendance: attendance.length,
          certificates: certificates.length,
          students: students.length,
        },
      },
    });

    const dateTag = new Date().toISOString().split('T')[0];

    if (format === 'sql') {
      const lines: string[] = [
        `-- Technosavvys WMS Automated Backup (${new Date().toISOString()})`,
        `SET FOREIGN_KEY_CHECKS = 0;`,
      ];

      for (const w of workshops) {
        lines.push(
          `INSERT INTO workshops (id, title, category, trainer, trainer_role, date, time, duration, location, capacity, price, status, description, tags, enrolled_count) VALUES (${sqlEscape(w.id)}, ${sqlEscape(w.title)}, ${sqlEscape(w.category)}, ${sqlEscape(w.trainer)}, ${sqlEscape(w.trainerRole)}, ${sqlEscape(w.date)}, ${sqlEscape(w.time)}, ${sqlEscape(w.duration)}, ${sqlEscape(w.location)}, ${Number(w.capacity) || 60}, ${Number(w.price) || 0}, ${sqlEscape(w.status)}, ${sqlEscape(w.description)}, ${sqlEscape(JSON.stringify(w.tags || []))}, ${Number(w.enrolledCount) || 0}) ON DUPLICATE KEY UPDATE title=VALUES(title);`
        );
        for (const s of w.sessions || []) {
          lines.push(
            `INSERT INTO workshop_sessions (id, workshop_id, session_title, date, start_time, end_time, location, status) VALUES (${sqlEscape(s.id)}, ${sqlEscape(w.id)}, ${sqlEscape(s.sessionTitle)}, ${sqlEscape(s.date)}, ${sqlEscape(s.startTime)}, ${sqlEscape(s.endTime)}, ${sqlEscape(s.location)}, ${sqlEscape(s.status)}) ON DUPLICATE KEY UPDATE session_title=VALUES(session_title);`
          );
        }
      }

      for (const st of students) {
        lines.push(
          `INSERT INTO students (id, name, email, phone, course, college, year, total_attended) VALUES (${sqlEscape(st.id)}, ${sqlEscape(st.name)}, ${sqlEscape(st.email)}, ${sqlEscape(st.phone)}, ${sqlEscape(st.course)}, ${sqlEscape(st.college)}, ${sqlEscape(st.year)}, ${Number(st.total_attended) || 0}) ON DUPLICATE KEY UPDATE name=VALUES(name);`
        );
      }

      for (const a of attendance) {
        lines.push(
          `INSERT INTO attendance_records (id, workshop_id, workshop_title, session_id, session_title, student_id, student_name, student_email, student_phone, student_course, date, time, server_timestamp, status, check_in_method, notes) VALUES (${sqlEscape(a.id)}, ${sqlEscape(a.workshopId)}, ${sqlEscape(a.workshopTitle)}, ${sqlEscape(a.sessionId)}, ${sqlEscape(a.sessionTitle)}, ${sqlEscape(a.studentId)}, ${sqlEscape(a.studentName)}, ${sqlEscape(a.studentEmail)}, ${sqlEscape(a.studentPhone)}, ${sqlEscape(a.studentCourse)}, ${sqlEscape(a.date)}, ${sqlEscape(a.time)}, ${sqlEscape(a.serverTimestamp)}, ${sqlEscape(a.status)}, ${sqlEscape(a.checkInMethod)}, ${sqlEscape(a.notes || '')}) ON DUPLICATE KEY UPDATE status=VALUES(status);`
        );
      }

      for (const c of certificates) {
        const certNo = c.certificateNo || c.id;
        lines.push(
          `INSERT INTO certificates (certificate_no, student_name, student_email, student_phone, workshop_id, workshop_title, issue_date, trainer_name, grade, verification_code, score) VALUES (${sqlEscape(certNo)}, ${sqlEscape(c.studentName)}, ${sqlEscape(c.studentEmail || '')}, ${sqlEscape(c.studentPhone || '')}, ${sqlEscape(c.workshopId)}, ${sqlEscape(c.workshopTitle || '')}, ${sqlEscape(c.issueDate || '')}, ${sqlEscape(c.trainer || '')}, ${sqlEscape(c.grade || 'Distinction')}, ${sqlEscape(certNo)}, ${sqlEscape(c.score || '95%')}) ON DUPLICATE KEY UPDATE grade=VALUES(grade);`
        );
      }

      lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="technosavvys-backup-${dateTag}.sql"`,
        },
      });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      workshops,
      students,
      attendance,
      certificates,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="technosavvys-backup-${dateTag}.json"`,
      },
    });
  } catch (err: any) {
    console.error('[API /api/admin/backup GET Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to export backup.' },
      { status: 500 }
    );
  }
}
