import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeStudentName,
  createStudentSessionToken,
} from '@/lib/studentAuth';
import {
  setSessionCookie,
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  STUDENT_ABSOLUTE_EXPIRY_MS,
} from '@/lib/sessionManager';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { INITIAL_STUDENTS, INITIAL_CERTIFICATES, INITIAL_WORKSHOPS } from '@/data/mockData';
import { getAllAttendanceRecords } from '@/lib/attendanceStore';
import { getAllCertificates } from '@/lib/certificateStore';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const body = await request.json();
    const { fullName, email } = body;

    const targetEmail = (email || '').trim().toLowerCase();
    const targetName = (fullName || '').trim();

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Registered email address is required.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const cleanName = targetName ? normalizeStudentName(targetName) : null;

    let matchedStudent: {
      id: string;
      name: string;
      email: string;
      phone: string;
      regNo: string;
      college: string;
      batch: string;
    } | null = null;

    // 1. Check in live Attendance Records
    try {
      const attendance = await getAllAttendanceRecords();
      const foundInAtt = attendance.find((a) => {
        const matchesEmail = a.studentEmail && a.studentEmail.trim().toLowerCase() === targetEmail;
        if (!matchesEmail) return false;

        if (!cleanName) return true;
        const sName = normalizeStudentName(a.studentName || '');
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });

      if (foundInAtt) {
        matchedStudent = {
          id: foundInAtt.studentId || foundInAtt.id,
          name: foundInAtt.studentName,
          email: foundInAtt.studentEmail || targetEmail,
          phone: foundInAtt.studentPhone || '',
          regNo: foundInAtt.studentRegNo || foundInAtt.studentId || 'TS-REG',
          college: foundInAtt.studentCourse || 'Engineering & Technology',
          batch: foundInAtt.date || new Date().toISOString().split('T')[0],
        };
      }
    } catch {}

    // 2. Check in Supabase Students table if configured
    if (!matchedStudent && isSupabaseConfigured()) {
      try {
        const supabaseAdmin = createAdminClient();
        const { data, error } = await supabaseAdmin
          .from('students')
          .select('*');

        if (!error && data && data.length > 0) {
          const found = data.find((s) => {
            const matchesEmail = s.email && s.email.trim().toLowerCase() === targetEmail;
            if (!matchesEmail) return false;

            if (!cleanName) return true;
            const sName = normalizeStudentName(s.name || '');
            return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
          });

          if (found) {
            matchedStudent = {
              id: found.id,
              name: found.name,
              email: found.email || targetEmail,
              phone: found.phone || '',
              regNo: found.reg_no || found.id,
              college: found.college || 'Engineering & Technology',
              batch: found.batch || 'Batch 2026',
            };
          }
        }
      } catch {}
    }

    // 3. Check in Mock Dataset
    if (!matchedStudent) {
      const mockMatch = INITIAL_STUDENTS.find((s) => {
        const matchesEmail = s.email && s.email.trim().toLowerCase() === targetEmail;
        if (!matchesEmail) return false;

        if (!cleanName) return true;
        const sName = normalizeStudentName(s.name);
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });

      if (mockMatch) {
        matchedStudent = {
          id: mockMatch.id,
          name: mockMatch.name,
          email: mockMatch.email,
          phone: mockMatch.phone,
          regNo: mockMatch.regNo,
          college: mockMatch.college,
          batch: mockMatch.batch,
        };
      }
    }

    // If still not matched, check if any certificate exists with this email or name
    if (!matchedStudent) {
      try {
        const certs = await getAllCertificates();
        const foundCert = certs.find((c) => {
          const matchesEmail = c.studentEmail && c.studentEmail.trim().toLowerCase() === targetEmail;
          if (!matchesEmail) return false;
          if (!cleanName) return true;
          const sName = normalizeStudentName(c.studentName || '');
          return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
        });

        if (foundCert) {
          matchedStudent = {
            id: foundCert.studentId || foundCert.id,
            name: foundCert.studentName,
            email: foundCert.studentEmail || targetEmail,
            phone: '',
            regNo: foundCert.studentId || 'TS-REG',
            college: 'Engineering & Technology',
            batch: foundCert.issueDate || '2026',
          };
        }
      } catch {}
    }

    if (!matchedStudent) {
      return NextResponse.json(
        {
          error: targetName
            ? `No registered record found for "${targetName}" with email "${targetEmail}". Please ensure your details match your workshop attendance.`
            : `No registered record found for email "${targetEmail}". Please ensure your email matches your workshop attendance.`,
        },
        { status: 404 }
      );
    }

    // Fetch certificates for matched student
    let certsList: any[] = [];

    // Check stored certificates
    try {
      const stored = await getAllCertificates({ studentId: matchedStudent.id });
      if (stored && stored.length > 0) {
        certsList = stored.map((c) => ({
          id: c.id,
          certificateNo: c.certificateNo || c.id,
          studentId: c.studentId,
          studentName: c.studentName,
          workshopId: c.workshopId,
          workshopTitle: c.workshopTitle || 'Workshop Credential',
          trainer: c.trainer || 'Lead Instructor',
          issueDate: c.issueDate || new Date().toISOString().split('T')[0],
          grade: c.grade || 'Pass',
          score: c.score,
          status: c.status || 'Issued',
          storagePath: c.storagePath || c.pdfUrl || `certificates/${c.id}.pdf`,
          fileName: c.fileName || `${c.studentName.replace(/\s+/g, '_')}_Certificate.pdf`,
        }));
      }
    } catch {}

    // Check Supabase certificates if configured
    if (certsList.length === 0 && isSupabaseConfigured()) {
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
          .eq('student_id', matchedStudent.id);

        if (!error && data && data.length > 0) {
          certsList = data.map((c: any) => ({
            id: c.id,
            certificateNo: c.certificate_no,
            studentId: c.student_id,
            workshopId: c.workshop_id,
            workshopTitle: c.workshops?.title || 'Workshop Credential',
            trainer: c.trainer_name || c.workshops?.trainer || 'Lead Instructor',
            issueDate: c.issue_date,
            grade: c.grade,
            score: c.score,
            status: c.status,
            storagePath: c.storage_path,
            fileName: c.file_name,
          }));
        }
      } catch {}
    }

    // Fallback to mock certificates
    if (certsList.length === 0) {
      const matched = INITIAL_CERTIFICATES.filter(
        (c) => c.studentId === matchedStudent!.id
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
          grade: c.grade,
          score: c.score,
          status: c.status,
          storagePath: c.storagePath || `certificates/${c.id}.pdf`,
          fileName: c.fileName || `${c.certificateNo}.pdf`,
        };
      });
    }

    // Generate signed HMAC student session token
    const token = createStudentSessionToken(matchedStudent);

    await logAuditEvent({
      action: 'STUDENT_DIRECT_LOGIN',
      entityType: 'Auth',
      entityId: matchedStudent.id,
      details: {
        studentName: matchedStudent.name,
        email: matchedStudent.email,
        certificatesFound: certsList.length,
        ip,
      },
    });

    const response = NextResponse.json({
      success: true,
      token,
      student: matchedStudent,
      certificates: certsList,
    });

    // Set secure student session cookies (2 Hours Absolute Expiry)
    const maxAgeSeconds = Math.floor(STUDENT_ABSOLUTE_EXPIRY_MS / 1000);
    setSessionCookie(response, STUDENT_COOKIE_NAME, token, maxAgeSeconds, request);
    setSessionCookie(response, LEGACY_STUDENT_COOKIE_NAME, token, maxAgeSeconds, request);

    return response;
  } catch (err: any) {
    console.error('[Direct Login API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing login.' },
      { status: 500 }
    );
  }
}
