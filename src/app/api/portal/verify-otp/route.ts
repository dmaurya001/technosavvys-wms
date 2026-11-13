import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import {
  normalizePhoneNumber,
  normalizeIdentifier,
  verifyStudentOtp,
  createStudentSessionToken,
} from '@/lib/studentAuth';
import {
  setSessionCookie,
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  STUDENT_ABSOLUTE_EXPIRY_MS,
} from '@/lib/sessionManager';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_STUDENTS } from '@/data/mockData';
import { getAllAttendanceRecords } from '@/lib/attendanceStore';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const body = await request.json();
    const { email, mobileNumber, identifier, otp } = body;

    const rawId = email || identifier || mobileNumber;
    if (!rawId || !otp) {
      return NextResponse.json(
        { error: 'Registered email/mobile and 6-digit OTP code are required.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = normalizeIdentifier(rawId);

    // Rate limit: Max 5 verification attempts per 5 minutes per IP + Identifier
    const rateCheck = rateLimiter.check(`otp_verify:${ip}:${cleanIdentifier}`, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          retryAfter: rateCheck.resetInSeconds,
        },
        { status: 429 }
      );
    }

    // Verify OTP
    const verification = verifyStudentOtp(cleanIdentifier, otp);
    if (!verification.success || !verification.studentId) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired OTP code.' },
        { status: 400 }
      );
    }

    // Reset rate limiter on successful auth
    rateLimiter.reset(`otp_verify:${ip}:${cleanIdentifier}`);
    rateLimiter.reset(`otp_req:${ip}:${cleanIdentifier}`);

    // Fetch full student record across:
    // 1. Live Attendance Store
    // 2. Supabase Students
    // 3. Mock Dataset fallback
    let studentRecord: {
      id: string;
      name: string;
      email: string;
      phone: string;
      regNo: string;
      college: string;
      batch: string;
    } | null = null;

    // 1. Check in Attendance Records
    try {
      const attendance = await getAllAttendanceRecords();
      const attMatch = attendance.find(
        (a) =>
          a.studentId === verification.studentId ||
          a.id === verification.studentId ||
          (cleanIdentifier.includes('@') && a.studentEmail && a.studentEmail.toLowerCase() === cleanIdentifier) ||
          (!cleanIdentifier.includes('@') && a.studentPhone && normalizePhoneNumber(a.studentPhone) === cleanIdentifier)
      );

      if (attMatch) {
        studentRecord = {
          id: attMatch.studentId || attMatch.id,
          name: attMatch.studentName,
          email: attMatch.studentEmail || (cleanIdentifier.includes('@') ? cleanIdentifier : ''),
          phone: attMatch.studentPhone || (!cleanIdentifier.includes('@') ? cleanIdentifier : ''),
          regNo: attMatch.studentRegNo || attMatch.studentId || 'TS-REG',
          college: attMatch.studentCourse || 'Engineering & Technology',
          batch: attMatch.date || new Date().toISOString().split('T')[0],
        };
      }
    } catch {}

    // 2. Check Supabase
    if (!studentRecord) {
      try {
        const supabaseAdmin = createAdminClient();
        const { data, error } = await supabaseAdmin
          .from('students')
          .select('*')
          .eq('id', verification.studentId)
          .single();

        if (!error && data) {
          studentRecord = {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            regNo: data.reg_no,
            college: data.college,
            batch: data.batch,
          };
        }
      } catch {}
    }

    // 3. Check Mock Dataset
    if (!studentRecord) {
      const mock = INITIAL_STUDENTS.find(
        (s) =>
          s.id === verification.studentId ||
          (cleanIdentifier.includes('@') && s.email && s.email.toLowerCase() === cleanIdentifier) ||
          (!cleanIdentifier.includes('@') && s.phone && normalizePhoneNumber(s.phone) === cleanIdentifier)
      );
      if (mock) {
        studentRecord = {
          id: mock.id,
          name: mock.name,
          email: mock.email,
          phone: mock.phone,
          regNo: mock.regNo,
          college: mock.college,
          batch: mock.batch,
        };
      }
    }

    if (!studentRecord) {
      return NextResponse.json(
        { error: 'Student profile record could not be resolved.' },
        { status: 404 }
      );
    }

    // Generate signed HMAC session token
    const token = createStudentSessionToken(studentRecord);

    await logAuditEvent({
      action: 'STUDENT_OTP_VERIFIED',
      entityType: 'Auth',
      entityId: studentRecord.id,
      details: {
        studentName: studentRecord.name,
        regNo: studentRecord.regNo,
        ip,
      },
    });

    const response = NextResponse.json({
      success: true,
      token,
      student: studentRecord,
    });

    // Set secure HttpOnly, SameSite=Lax student session cookies (2 Hours Absolute Expiry)
    const maxAgeSeconds = Math.floor(STUDENT_ABSOLUTE_EXPIRY_MS / 1000);
    setSessionCookie(response, STUDENT_COOKIE_NAME, token, maxAgeSeconds, request);
    setSessionCookie(response, LEGACY_STUDENT_COOKIE_NAME, token, maxAgeSeconds, request);

    return response;
  } catch (err: any) {
    console.error('[Verify OTP API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error verifying OTP.' },
      { status: 500 }
    );
  }
}
