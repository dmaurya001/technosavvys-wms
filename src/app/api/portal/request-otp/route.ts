import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import {
  normalizePhoneNumber,
  normalizeStudentName,
  normalizeIdentifier,
  generateStudentOtp,
  maskEmail,
  maskPhone,
} from '@/lib/studentAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_STUDENTS } from '@/data/mockData';
import { getAllAttendanceRecords } from '@/lib/attendanceStore';
import { sendOtpEmail } from '@/lib/emailService';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const body = await request.json();
    const { fullName, email, mobileNumber, identifier } = body;

    const targetEmail = (email || (identifier && identifier.includes('@') ? identifier : '') || '')
      .trim()
      .toLowerCase();
    const targetPhone = (mobileNumber || (identifier && !identifier.includes('@') ? identifier : '') || '')
      .trim();

    if (!targetEmail && !targetPhone) {
      return NextResponse.json(
        { error: 'Registered email address or mobile number is required.' },
        { status: 400 }
      );
    }

    if (targetEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const cleanPhone = targetPhone ? normalizePhoneNumber(targetPhone) : '';
    if (targetPhone && cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    const cleanName =
      fullName && typeof fullName === 'string' && fullName.trim()
        ? normalizeStudentName(fullName)
        : null;

    const rateKey = targetEmail ? `otp_req:${ip}:${targetEmail}` : `otp_req:${ip}:${cleanPhone}`;
    const rateCheck = rateLimiter.check(rateKey, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          retryAfter: rateCheck.resetInSeconds,
        },
        { status: 429 }
      );
    }

    // Lookup student across:
    // 1. Attendance Records (live attendance store)
    // 2. Supabase Students Table
    // 3. Mock Dataset fallback
    let matchedStudent: {
      id: string;
      name: string;
      email: string;
      phone: string;
      regNo: string;
    } | null = null;

    // 1. Check in attendance records
    try {
      const attendance = await getAllAttendanceRecords();
      const foundInAtt = attendance.find((a) => {
        const matchesEmail = targetEmail && a.studentEmail && a.studentEmail.trim().toLowerCase() === targetEmail;
        const matchesPhone = cleanPhone && a.studentPhone && normalizePhoneNumber(a.studentPhone) === cleanPhone;
        if (!matchesEmail && !matchesPhone) return false;

        if (!cleanName) return true;
        const sName = normalizeStudentName(a.studentName || '');
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });

      if (foundInAtt) {
        matchedStudent = {
          id: foundInAtt.studentId || foundInAtt.id,
          name: foundInAtt.studentName,
          email: foundInAtt.studentEmail || targetEmail,
          phone: foundInAtt.studentPhone || targetPhone,
          regNo: foundInAtt.studentRegNo || foundInAtt.studentId || 'TS-REG',
        };
      }
    } catch {}

    // 2. Check in Supabase if not yet resolved
    if (!matchedStudent) {
      try {
        const supabaseAdmin = createAdminClient();
        const { data, error } = await supabaseAdmin
          .from('students')
          .select('id, name, email, phone, reg_no');

        if (!error && data && data.length > 0) {
          const found = data.find((s) => {
            const matchesEmail = targetEmail && s.email && s.email.trim().toLowerCase() === targetEmail;
            const matchesPhone = cleanPhone && s.phone && normalizePhoneNumber(s.phone) === cleanPhone;
            if (!matchesEmail && !matchesPhone) return false;

            if (!cleanName) return true;
            const sName = normalizeStudentName(s.name || '');
            return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
          });

          if (found) {
            matchedStudent = {
              id: found.id,
              name: found.name,
              email: found.email || targetEmail,
              phone: found.phone || targetPhone,
              regNo: found.reg_no || found.id,
            };
          }
        }
      } catch {}
    }

    // 3. Check in Mock Dataset
    if (!matchedStudent) {
      const mockMatch = INITIAL_STUDENTS.find((s) => {
        const matchesEmail = targetEmail && s.email && s.email.trim().toLowerCase() === targetEmail;
        const matchesPhone = cleanPhone && s.phone && normalizePhoneNumber(s.phone) === cleanPhone;
        if (!matchesEmail && !matchesPhone) return false;

        if (!cleanName) return true;
        const sName = normalizeStudentName(s.name);
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });

      if (mockMatch) {
        matchedStudent = {
          id: mockMatch.id,
          name: mockMatch.name,
          email: mockMatch.email || targetEmail,
          phone: mockMatch.phone || targetPhone,
          regNo: mockMatch.regNo,
        };
      }
    }

    if (!matchedStudent) {
      return NextResponse.json(
        {
          error:
            targetEmail
              ? 'No matching student record found for the provided name and email address. Please check your registered workshop email.'
              : 'No matching student record found for the provided name and mobile number. Please check your credentials.',
        },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP with 5-minute validity
    const otpIdentifier = targetEmail || cleanPhone;
    const otpCode = generateStudentOtp(otpIdentifier, matchedStudent.id, matchedStudent.name);

    // Send OTP via Email if email is available
    const emailToSend = targetEmail || matchedStudent.email;
    let emailResult: { success: boolean; delivered: boolean; error?: string } = {
      success: false,
      delivered: false,
    };
    if (emailToSend) {
      emailResult = await sendOtpEmail({
        toEmail: emailToSend,
        studentName: matchedStudent.name,
        otpCode,
      });
    }

    await logAuditEvent({
      action: 'STUDENT_OTP_REQUEST',
      entityType: 'Auth',
      entityId: matchedStudent.id,
      details: {
        studentName: matchedStudent.name,
        emailMasked: emailToSend ? maskEmail(emailToSend) : undefined,
        phoneMasked: matchedStudent.phone ? maskPhone(matchedStudent.phone) : undefined,
        emailDelivered: emailResult.delivered,
        ip,
      },
    });

    const isDevMode =
      process.env.NODE_ENV !== 'production' ||
      process.env.ENABLE_DEV_OTP === 'true' ||
      !emailResult.delivered;

    const maskedEmail = emailToSend ? maskEmail(emailToSend) : '';
    const maskedPhone = matchedStudent.phone ? maskPhone(matchedStudent.phone) : '';

    const responsePayload: Record<string, any> = {
      success: true,
      message: targetEmail
        ? `OTP code sent successfully to registered email ${maskedEmail}. Valid for 5 minutes.`
        : `OTP sent successfully to registered number ${maskedPhone}. Valid for 5 minutes.`,
      maskedEmail,
      maskedPhone,
      studentName: matchedStudent.name,
      emailDelivered: emailResult.delivered,
    };

    if (isDevMode) {
      responsePayload.simulatedOtp = otpCode;
      responsePayload.devOtp = otpCode;
    }

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    console.error('[Request OTP API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing OTP request.' },
      { status: 500 }
    );
  }
}
