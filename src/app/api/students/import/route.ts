import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';
import { logAuditEvent } from '@/lib/audit';

interface ImportStudentInput {
  id?: string;
  name: string;
  email: string;
  phone: string;
  course?: string;
  college?: string;
  year?: string;
  workshopId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request, 'teacher');
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { students, defaultWorkshopId } = body as {
      students: ImportStudentInput[];
      defaultWorkshopId?: string;
    };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'No student rows provided for import.' },
        { status: 400 }
      );
    }

    if (students.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 students can be imported in a single batch.' },
        { status: 400 }
      );
    }

    let imported = 0;
    const skipped: Array<{ row: number; email: string; reason: string }> = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const name = String(s.name || '').trim();
      const email = String(s.email || '').trim().toLowerCase();
      const phone = String(s.phone || '').trim();

      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ row: i + 1, email: email || 'missing', reason: 'Invalid name or email' });
        continue;
      }

      const studentId =
        String(s.id || '').trim() ||
        `STU-${crypto.createHash('sha1').update(email).digest('hex').slice(0, 8).toUpperCase()}`;

      if (isMySQLConfigured()) {
        await executeMySQLQuery(
          `INSERT INTO students (id, name, email, phone, course, college, year)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             phone = VALUES(phone),
             course = VALUES(course),
             college = VALUES(college),
             year = VALUES(year)`,
          [
            studentId,
            name,
            email,
            phone || '0000000000',
            String(s.course || 'ADCA').trim(),
            String(s.college || 'Campus').trim(),
            String(s.year || 'Final Year').trim(),
          ]
        );

        const wsId = String(s.workshopId || defaultWorkshopId || '').trim();
        if (wsId) {
          await executeMySQLQuery(
            `INSERT IGNORE INTO workshop_enrollments (student_id, workshop_id)
             SELECT id, ? FROM students WHERE email = ? LIMIT 1`,
            [wsId, email]
          );
        }
      }

      imported++;
    }

    await logAuditEvent({
      action: 'BULK_STUDENT_IMPORT',
      entityType: 'Student',
      details: {
        imported,
        skippedCount: skipped.length,
        by: auth.session.email,
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      message: `Imported ${imported} student(s)${skipped.length ? `, skipped ${skipped.length}` : ''}.`,
    });
  } catch (err: any) {
    console.error('[API /api/students/import POST Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to import students.' },
      { status: 500 }
    );
  }
}
