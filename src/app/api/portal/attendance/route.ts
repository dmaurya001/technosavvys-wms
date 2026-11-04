import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentSessionToken } from '@/lib/studentAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_ATTENDANCE } from '@/data/mockData';
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

    // Reject teacher from student portal endpoints unless student credentials are provided
    if (teacherCookie && !cookieToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { error: 'Forbidden: Student privileges required for student portal attendance.' },
        { status: 403 }
      );
    }

    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing student authorization token.' },
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

    const { studentId, phone, name } = sessionPayload;

    let attendanceList: any[] = [];

    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .select(`
          id,
          workshop_id,
          session_id,
          student_id,
          check_in_time,
          status,
          method,
          notes,
          students (
            id,
            name,
            email,
            phone
          ),
          workshops (
            id,
            title,
            trainer
          ),
          workshop_sessions (
            id,
            session_title,
            session_date,
            start_time,
            end_time
          )
        `)
        .eq('student_id', studentId)
        .order('check_in_time', { ascending: false });

      if (!error && data && data.length > 0) {
        attendanceList = data.map((rec) => ({
          id: rec.id,
          workshopId: rec.workshop_id,
          workshopTitle: (rec.workshops as any)?.title || 'Academic Workshop',
          sessionId: rec.session_id,
          sessionTitle: (rec.workshop_sessions as any)?.session_title || 'Session',
          studentId: rec.student_id,
          studentName: (rec.students as any)?.name || name,
          date: (rec.workshop_sessions as any)?.session_date || rec.check_in_time?.split('T')[0],
          time: (rec.workshop_sessions as any)?.start_time || '10:00 AM',
          serverTimestamp: rec.check_in_time,
          status: rec.status,
          method: rec.method || 'QR Scan',
        }));
      }
    } catch {
      // Offline fallback
    }

    if (attendanceList.length === 0) {
      // Filter mock attendance matching studentId or normalized phone or normalized name
      const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
      const matched = INITIAL_ATTENDANCE.filter(
        (a) =>
          a.studentId === studentId ||
          (cleanPhone && a.studentPhone?.replace(/\D/g, '').slice(-10) === cleanPhone) ||
          (name && a.studentName?.toLowerCase() === name.toLowerCase())
      );

      attendanceList = matched.map((a) => ({
        id: a.id,
        workshopId: a.workshopId,
        workshopTitle: a.workshopTitle,
        sessionId: a.sessionId,
        sessionTitle: a.sessionTitle,
        studentId: a.studentId || studentId,
        studentName: a.studentName,
        studentEmail: a.studentEmail,
        studentPhone: a.studentPhone,
        studentCourse: a.studentCourse,
        date: a.date,
        time: a.time,
        serverTimestamp: a.serverTimestamp,
        status: a.status,
        method: a.checkInMethod || 'QR Scan',
      }));
    }

    return NextResponse.json({
      success: true,
      attendance: attendanceList,
      totalCount: attendanceList.length,
    });
  } catch (err: any) {
    console.error('[Get Attendance API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error retrieving student attendance.' },
      { status: 500 }
    );
  }
}

