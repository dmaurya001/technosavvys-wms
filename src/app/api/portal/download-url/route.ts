import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import { verifyStudentSessionToken, normalizeStudentName } from '@/lib/studentAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_CERTIFICATES } from '@/data/mockData';
import { getAllCertificates } from '@/lib/certificateStore';
import { logAuditEvent } from '@/lib/audit';
import {
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  TEACHER_COOKIE_NAME,
} from '@/lib/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const authHeader = request.headers.get('authorization');
    const cookieToken =
      request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
      request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;
    const teacherCookie = request.cookies.get(TEACHER_COOKIE_NAME)?.value;

    // Reject teacher from downloading student certificates without valid student session
    if (teacherCookie && !cookieToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { error: 'Forbidden: Student privileges required to generate student certificate download link.' },
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

    // Rate limit: Max 15 downloads per minute per student
    const rateCheck = rateLimiter.check(`download:${ip}:${studentId}`, 15, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.message,
          retryAfter: rateCheck.resetInSeconds,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { certificateId } = body;

    if (!certificateId || typeof certificateId !== 'string') {
      return NextResponse.json(
        { error: 'Certificate ID is required.' },
        { status: 400 }
      );
    }

    // Lookup certificate
    let certRecord: {
      id: string;
      studentId: string;
      studentName?: string;
      studentEmail?: string;
      certificateNo: string;
      storagePath?: string | null;
      fileName?: string | null;
    } | null = null;

    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin
        .from('certificates')
        .select('id, student_id, certificate_no, storage_path, file_name')
        .eq('id', certificateId)
        .single();

      if (!error && data) {
        certRecord = {
          id: data.id,
          studentId: data.student_id,
          certificateNo: data.certificate_no,
          storagePath: data.storage_path,
          fileName: data.file_name,
        };
      }
    } catch {
      // Offline fallback
    }

    if (!certRecord) {
      try {
        const stored = await getAllCertificates();
        const found = stored.find((c) => c.id === certificateId);
        if (found) {
          certRecord = {
            id: found.id,
            studentId: found.studentId,
            studentName: found.studentName,
            studentEmail: found.studentEmail,
            certificateNo: found.certificateNo,
            storagePath: found.storagePath || `certificates/${found.id}.pdf`,
            fileName: found.fileName || `${(found.studentName || 'Student').replace(/\s+/g, '_')}_Certificate.pdf`,
          };
        }
      } catch {}
    }

    if (!certRecord) {
      const mock = INITIAL_CERTIFICATES.find((c) => c.id === certificateId);
      if (mock) {
        certRecord = {
          id: mock.id,
          studentId: mock.studentId,
          studentName: mock.studentName,
          studentEmail: mock.studentEmail,
          certificateNo: mock.certificateNo,
          storagePath: mock.storagePath || `certificates/${mock.id}.pdf`,
          fileName: mock.fileName || `${mock.certificateNo}.pdf`,
        };
      }
    }

    if (!certRecord) {
      return NextResponse.json(
        { error: 'Certificate record not found.' },
        { status: 404 }
      );
    }

    // STRICT AUTHORIZATION CHECK (Prevent Unauthorized Access / IDOR)
    const isAuthorized =
      certRecord.studentId === studentId ||
      ((certRecord as any).studentName && sessionPayload.name && normalizeStudentName((certRecord as any).studentName) === normalizeStudentName(sessionPayload.name));

    if (!isAuthorized) {
      await logAuditEvent({
        action: 'SECURITY_UNAUTHORIZED_ACCESS_BLOCKED',
        entityType: 'Security',
        entityId: certificateId,
        details: {
          attemptedByStudentId: studentId,
          targetCertificateStudentId: certRecord.studentId,
          ip,
          certificateNo: certRecord.certificateNo,
        },
      });

      return NextResponse.json(
        {
          error:
            'Access Denied: You are not authorized to access or download credentials belonging to another student.',
        },
        { status: 403 }
      );
    }

    // Generate 60-second temporary signed URL
    const expiresInSeconds = 60;
    let signedUrl: string | null = null;

    if (certRecord.storagePath) {
      try {
        const supabaseAdmin = createAdminClient();
        const { data: signedData, error: signError } = await supabaseAdmin.storage
          .from('certificates')
          .createSignedUrl(certRecord.storagePath, expiresInSeconds);

        if (!signError && signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        }
      } catch {
        // Fallback signed URL for offline testing
      }
    }

    // If storage path was not yet uploaded or offline mock, generate an authenticated download URL
    if (!signedUrl) {
      const cleanFileName = (certRecord.fileName || `${certRecord.certificateNo}.pdf`).replace(/\s+/g, '_');
      signedUrl = `/api/portal/render-pdf?id=${encodeURIComponent(certRecord.id)}&auth=${encodeURIComponent(token)}&expires=${Date.now() + expiresInSeconds * 1000}`;
    }

    await logAuditEvent({
      action: 'STUDENT_CERTIFICATE_DOWNLOAD',
      entityType: 'Certificate',
      entityId: certRecord.id,
      details: {
        studentId,
        certificateNo: certRecord.certificateNo,
        expiresInSeconds,
        ip,
      },
    });

    return NextResponse.json({
      success: true,
      certificateNo: certRecord.certificateNo,
      fileName: certRecord.fileName || `${certRecord.certificateNo}.pdf`,
      signedUrl,
      expiresInSeconds,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });
  } catch (err: any) {
    console.error('[Download URL API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error generating signed download URL.' },
      { status: 500 }
    );
  }
}

