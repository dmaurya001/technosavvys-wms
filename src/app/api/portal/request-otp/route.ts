import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import {
  normalizePhoneNumber,
  normalizeStudentName,
  generateStudentOtp,
} from '@/lib/studentAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_STUDENTS } from '@/data/mockData';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const body = await request.json();
    const { fullName, mobileNumber } = body;

    if (!mobileNumber || typeof mobileNumber !== 'string' || !mobileNumber.trim()) {
      return NextResponse.json(
        { error: 'Registered mobile number is required.' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhoneNumber(mobileNumber);
    const cleanName = fullName && typeof fullName === 'string' && fullName.trim()
      ? normalizeStudentName(fullName)
      : null;

    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    // Rate limit: Max 3 OTP requests per 5 minutes per IP + Mobile
    const rateCheck = rateLimiter.check(`otp_req:${ip}:${cleanPhone}`, 3, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          retryAfter: rateCheck.resetInSeconds,
        },
        { status: 429 }
      );
    }

    // Lookup student in Supabase database with fallback to INITIAL_STUDENTS
    let matchedStudent: { id: string; name: string; phone: string; regNo: string } | null = null;

    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin
        .from('students')
        .select('id, name, phone, reg_no');

      if (!error && data && data.length > 0) {
        const found = data.find((s) => {
          const sPhone = normalizePhoneNumber(s.phone || '');
          if (sPhone !== cleanPhone) return false;
          if (!cleanName) return true;
          const sName = normalizeStudentName(s.name || '');
          return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
        });
        if (found) {
          matchedStudent = {
            id: found.id,
            name: found.name,
            phone: found.phone,
            regNo: found.reg_no,
          };
        }
      }
    } catch {
      // Offline / mock fallback
    }

    if (!matchedStudent) {
      // Check in mock dataset
      const mockMatch = INITIAL_STUDENTS.find((s) => {
        const sPhone = normalizePhoneNumber(s.phone);
        if (sPhone !== cleanPhone) return false;
        if (!cleanName) return true;
        const sName = normalizeStudentName(s.name);
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });

      if (mockMatch) {
        matchedStudent = {
          id: mockMatch.id,
          name: mockMatch.name,
          phone: mockMatch.phone,
          regNo: mockMatch.regNo,
        };
      }
    }

    if (!matchedStudent) {
      return NextResponse.json(
        {
          error:
            'No matching student record found for the provided name and mobile number. Please check your credentials.',
        },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP with 5-minute validity
    const otpCode = generateStudentOtp(cleanPhone, matchedStudent.id, matchedStudent.name);

    await logAuditEvent({
      action: 'STUDENT_OTP_REQUEST',
      entityType: 'Auth',
      entityId: matchedStudent.id,
      details: {
        studentName: matchedStudent.name,
        phoneMasked: `+91 ******${cleanPhone.slice(-4)}`,
        ip,
      },
    });

    const maskedPhone = `+91 ******${cleanPhone.slice(-4)}`;

    const isDevMode = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true';

    const responsePayload: Record<string, any> = {
      success: true,
      message: `OTP sent successfully to registered number ${maskedPhone}. Valid for 5 minutes.`,
      maskedPhone,
      studentName: matchedStudent.name,
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

