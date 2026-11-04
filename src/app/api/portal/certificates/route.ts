import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentSessionToken } from '@/lib/studentAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_CERTIFICATES, INITIAL_WORKSHOPS } from '@/data/mockData';
import {
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  TEACHER_COOKIE_NAME,
} from '@/lib/sessionManager';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken =
      request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
      request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;
    const teacherCookie = request.cookies.get(TEACHER_COOKIE_NAME)?.value;

    // Reject teacher without student credentials
    if (teacherCookie && !cookieToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { error: 'Forbidden: Student privileges required to access student certificates.' },
        { status: 403 }
      );
    }

    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or malformed student authorization token.' },
        { status: 401 }
      );
    }
    let sessionPayload;
    try {
      sessionPayload = verifyStudentSessionToken(token);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || 'Unauthorized: Invalid or expired student token.' },
        { status: 401 }
      );
    }

    const { studentId } = sessionPayload;

    let certsList: any[] = [];

    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin
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
            title,
            category,
            trainer
          )
        `)
        .eq('student_id', studentId)
        .eq('status', 'Issued');

      if (!error && data && data.length > 0) {
        certsList = data.map((c) => ({
          id: c.id,
          certificateNo: c.certificate_no,
          studentId: c.student_id,
          workshopId: c.workshop_id,
          workshopTitle: (c.workshops as any)?.title || 'Workshop Credential',
          trainer: c.trainer_name || (c.workshops as any)?.trainer || 'Lead Instructor',
          issueDate: c.issue_date,
          grade: c.grade,
          score: c.score,
          status: c.status,
          storagePath: c.storage_path,
          fileName: c.file_name,
        }));
      }
    } catch {
      // Offline fallback
    }

    if (certsList.length === 0) {
      // Fallback to mock certificates matching studentId
      const matched = INITIAL_CERTIFICATES.filter(
        (c) => c.studentId === studentId && c.status === 'Issued'
      );

      certsList = matched.map((c) => {
        const workshop = INITIAL_WORKSHOPS.find((w) => w.id === c.workshopId);
        return {
          id: c.id,
          certificateNo: c.certificateNo,
          studentId: c.studentId,
          studentName: c.studentName,
          workshopId: c.workshopId,
          workshopTitle: c.workshopTitle || workshop?.title || 'Executive Workshop',
          trainer: c.trainer || workshop?.trainer || 'Lead Instructor',
          issueDate: c.issueDate || workshop?.date || '2026-10-29',
          workshopDate: workshop?.date || c.issueDate,
          grade: c.grade,
          score: c.score,
          status: c.status,
          storagePath: c.storagePath || `certificates/${c.id}.pdf`,
          fileName: c.fileName || `${c.certificateNo}.pdf`,
        };
      });
    }

    return NextResponse.json({
      success: true,
      certificates: certsList,
      totalCount: certsList.length,
    });
  } catch (err: any) {
    console.error('[Get Certificates API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error retrieving certificates.' },
      { status: 500 }
    );
  }
}

