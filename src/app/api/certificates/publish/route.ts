import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAllAttendanceRecords } from '@/lib/attendanceStore';
import { saveCertificate } from '@/lib/certificateStore';
import { normalizeStudentName } from '@/lib/studentAuth';
import { logAuditEvent } from '@/lib/audit';
import { Certificate } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request, 'teacher');
    if (!auth.valid || !auth.session) {
      return NextResponse.json(
        { error: 'Unauthorized: Administrator or Instructor credentials required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workshopId, workshopTitle, certificates } = body;

    if (!workshopId || !Array.isArray(certificates) || certificates.length === 0) {
      return NextResponse.json(
        { error: 'Workshop ID and an array of verified certificate mappings are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch live attendance records to enforce attendance approval constraint
    const allAttendance = await getAllAttendanceRecords();
    const approvedAttendees = allAttendance.filter(
      (a) =>
        a.status === 'APPROVED' ||
        a.status === 'Present' ||
        a.status === 'CERTIFICATE_ELIGIBLE'
    );

    const approvedAttendeeIds = new Set(
      approvedAttendees.flatMap((a) => [a.studentId, a.id].filter(Boolean) as string[])
    );

    // Also collect student emails/phones/names for flexible cross-referencing
    const approvedAttendeeEmails = new Set(
      approvedAttendees.map((a) => (a.studentEmail || '').toLowerCase()).filter(Boolean)
    );

    const approvedAttendeeNames = new Set(
      approvedAttendees.map((a) => normalizeStudentName(a.studentName || '')).filter(Boolean)
    );

    const publishedRecords: Certificate[] = [];
    const skippedRecords: Array<{ studentId: string; reason: string }> = [];

    const supabaseAdmin = isSupabaseConfigured() ? createAdminClient() : null;

    for (const item of certificates) {
      const studentId = item.studentId;
      if (!studentId) {
        skippedRecords.push({ studentId: 'unknown', reason: 'Missing student ID' });
        continue;
      }

      // Enforce: ONLY attendance-approved students can receive certificates
      const isApproved =
        item.attendanceApproved === true ||
        approvedAttendeeIds.has(studentId) ||
        (item.studentEmail && approvedAttendeeEmails.has(item.studentEmail.toLowerCase())) ||
        (item.studentName && approvedAttendeeNames.has(normalizeStudentName(item.studentName)));

      if (!isApproved) {
        skippedRecords.push({
          studentId,
          reason: 'Student does not have APPROVED attendance for this workshop.',
        });
        continue;
      }

      const certId = `CERT-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const certNumber = `TECH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const issueDate = new Date().toISOString().split('T')[0];
      const storagePath = `certificates/${workshopId}_${studentId}_${Date.now()}.pdf`;

      // 2. Upload PDF to private Supabase Storage if configured and fileBase64 provided
      if (supabaseAdmin && item.fileBase64) {
        try {
          const buffer = Buffer.from(item.fileBase64, 'base64');
          await supabaseAdmin.storage
            .from('certificates')
            .upload(storagePath, buffer, {
              contentType: 'application/pdf',
              upsert: true,
            });
        } catch (err) {
          console.warn('[Certificate Publish] Storage upload warning:', err);
        }
      }

      // 3. Upsert certificate metadata in PostgreSQL if Supabase is active
      if (supabaseAdmin) {
        try {
          // Resolve student UUID
          let studentUuid: string | null = null;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
          if (isUuid) {
            studentUuid = studentId;
          } else {
            const { data: stuRow } = await supabaseAdmin
              .from('students')
              .select('id')
              .or(`email.eq.${item.studentEmail || ''},full_name.eq.${item.studentName}`)
              .maybeSingle();
            if (stuRow?.id) studentUuid = stuRow.id;
          }

          // Resolve workshop UUID
          let wsUuid: string | null = null;
          const isWsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workshopId);
          if (isWsUuid) {
            wsUuid = workshopId;
          } else {
            const { data: wsRow } = await supabaseAdmin
              .from('workshops')
              .select('id')
              .or(`code.eq.${workshopId},title.eq.${workshopTitle || ''}`)
              .maybeSingle();
            if (wsRow?.id) wsUuid = wsRow.id;
          }

          if (studentUuid && wsUuid) {
            await supabaseAdmin.from('certificates').insert([
              {
                certificate_no: certNumber,
                student_id: studentUuid,
                workshop_id: wsUuid,
                trainer_name: item.trainer || 'Lead Instructor',
                issue_date: issueDate,
                grade: item.grade || 'Distinction',
                status: 'Issued',
                score: item.score || 95,
                verification_hash: `${certNumber}_${studentId}_${Date.now()}`,
                storage_path: storagePath,
                file_name: item.fileName,
              },
            ]);
          }
        } catch (err) {
          console.warn('[Certificate Publish] DB insert warning:', err);
        }
      }

      // 4. Save to persistent certificate store
      const certRecord: Certificate = {
        id: certId,
        certificateNo: certNumber,
        studentId,
        studentName: item.studentName || 'Participant',
        studentEmail: item.studentEmail || '',
        studentPhone: item.studentPhone || '',
        workshopId: item.workshopId || workshopId,
        workshopTitle: item.workshopTitle || workshopTitle || 'Technical Workshop',
        trainer: item.trainer || 'Lead Instructor',
        issueDate,
        grade: (item.grade as any) || 'Distinction',
        status: 'Issued',
        score: item.score || 95,
        storagePath,
        fileName: item.fileName,
      };

      await saveCertificate(certRecord);
      publishedRecords.push(certRecord);
    }

    await logAuditEvent({
      action: 'ISSUE_CERTIFICATES_BATCH',
      entityType: 'Certificate',
      details: {
        admin: (auth.session as any).email || 'Lead Instructor',
        workshopId,
        publishedCount: publishedRecords.length,
        skippedCount: skippedRecords.length,
      },
    });

    return NextResponse.json({
      success: true,
      publishedCount: publishedRecords.length,
      skippedCount: skippedRecords.length,
      skippedDetails: skippedRecords,
      certificates: publishedRecords,
      message: `Successfully published ${publishedRecords.length} certificate(s) for approved attendees.`,
    });
  } catch (err: any) {
    console.error('[Certificate Publish API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error while publishing certificates.' },
      { status: 500 }
    );
  }
}

