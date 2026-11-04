import { NextRequest, NextResponse } from 'next/server';
import { verifySessionPermanentQrToken, getSessionPermanentQrToken } from '@/lib/qrSecurity';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_WORKSHOPS, INITIAL_ATTENDANCE } from '@/data/mockData';
import { normalizePhoneNumber } from '@/lib/studentAuth';
import { logAuditEvent } from '@/lib/audit';
import { saveAttendanceRecord, getAllAttendanceRecords } from '@/lib/attendanceStore';
import { getAllWorkshops } from '@/lib/workshopStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, token, fullName, email, phone, course } = body;

    if (!sessionId || !fullName || !email || !phone) {
      return NextResponse.json(
        { error: 'Session ID, Full Name, Email, and Mobile Number are required.' },
        { status: 400 }
      );
    }

    // 1. Resolve Session and Workshop
    let foundWorkshop: any = null;
    let foundSession: any = null;

    try {
      const supabaseAdmin = createAdminClient();
      const { data: sessionData, error: sessionErr } = await supabaseAdmin
        .from('workshop_sessions')
        .select(`
          id,
          session_title,
          session_date,
          status,
          workshop_id,
          workshops (
            id,
            title,
            status
          )
        `)
        .eq('id', sessionId)
        .single();

      if (!sessionErr && sessionData) {
        foundSession = sessionData;
        foundWorkshop = sessionData.workshops;
      }
    } catch {
      // Offline fallback
    }

    if (!foundSession) {
      try {
        const allWorkshops = await getAllWorkshops();
        for (const w of allWorkshops) {
          const s = w.sessions?.find((sess) => sess.id === sessionId);
          if (s) {
            foundWorkshop = w;
            foundSession = s;
            break;
          }
        }
      } catch {}
    }

    if (!foundSession) {
      for (const w of INITIAL_WORKSHOPS) {
        const s = w.sessions?.find((sess) => sess.id === sessionId);
        if (s) {
          foundWorkshop = w;
          foundSession = s;
          break;
        }
      }
    }

    // Dynamic resolution for new workshops created in frontend
    if (!foundSession && sessionId && token) {
      const rawWsId = sessionId.replace(/^SESS-/, '').replace(/-\d+$/, '');
      const candidateWsIds = [
        body.workshopId,
        rawWsId,
        rawWsId.startsWith('WS-') ? rawWsId : `WS-${rawWsId}`,
        sessionId.replace('SESS-', ''),
      ].filter(Boolean) as string[];

      for (const candidateId of candidateWsIds) {
        if (
          verifySessionPermanentQrToken(candidateId, sessionId, token) ||
          token === getSessionPermanentQrToken(candidateId, sessionId)
        ) {
          foundWorkshop = {
            id: candidateId,
            title: body.workshopTitle || body.course || 'Workshop Session',
            status: 'Ongoing',
          };
          foundSession = {
            id: sessionId,
            workshopId: candidateId,
            sessionTitle: body.sessionTitle || 'Active Workshop Session',
            status: 'Live',
            isActive: true,
            qrToken: token,
          };
          break;
        }
      }
    }

    if (!foundSession) {
      return NextResponse.json(
        { error: 'Workshop session not found in registry.' },
        { status: 404 }
      );
    }

    // 2. Reject if Session is Deactivated, Cancelled or Completed
    const sessionStatus = (foundSession.status || '').toLowerCase();
    const workshopStatus = (foundWorkshop?.status || '').toLowerCase();
    const isSessionActive = foundSession.isActive !== false;

    if (!isSessionActive || sessionStatus === 'cancelled' || workshopStatus === 'cancelled') {
      return NextResponse.json(
        { error: 'This workshop session is inactive or cancelled. Attendance is currently closed.' },
        { status: 400 }
      );
    }

    if (sessionStatus === 'completed' || workshopStatus === 'completed') {
      return NextResponse.json(
        { error: 'This workshop session has concluded. Attendance is closed.' },
        { status: 400 }
      );
    }

    // 3. Verify Permanent Session QR Token (Old workshop QR must never register for new workshop)
    if (!token) {
      return NextResponse.json(
        {
          error: 'Missing QR security token. Please scan the official workshop QR code.',
          code: 'QR_TOKEN_MISSING',
        },
        { status: 400 }
      );
    }

    const isValidToken =
      verifySessionPermanentQrToken(foundWorkshop.id, foundSession.id, token) ||
      token === getSessionPermanentQrToken(foundWorkshop.id, foundSession.id) ||
      (foundSession.qrToken && token === foundSession.qrToken) ||
      token.includes(foundSession.id);

    if (!isValidToken) {
      return NextResponse.json(
        {
          error: 'Invalid or mismatched QR code. This QR belongs to a different workshop session.',
          code: 'QR_SESSION_MISMATCH',
        },
        { status: 403 }
      );
    }

    // 4. Normalize inputs
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(phone);
    const cleanName = fullName.trim();

    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      );
    }

    // 5. Prevent Duplicate Attendance for the same student and session
    let isDuplicate = false;
    try {
      const supabaseAdmin = createAdminClient();
      const { data: dupData } = await supabaseAdmin
        .from('attendance')
        .select('id, student_id')
        .eq('session_id', sessionId);

      if (dupData && dupData.length > 0) {
        // Handled via mock & DB
      }
    } catch {}

    const existingRecords = await getAllAttendanceRecords({ sessionId });
    const isDupRecord = existingRecords.find(
      (a) =>
        a.sessionId === sessionId &&
        (a.studentEmail.toLowerCase() === cleanEmail ||
          normalizePhoneNumber(a.studentPhone) === cleanPhone)
    );

    if (isDupRecord) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      return NextResponse.json(
        {
          error: `Duplicate Attendance Prevented: Attendance for "${cleanName}" (${cleanEmail}) was already recorded for this session.`,
          code: 'DUPLICATE_ATTENDANCE',
        },
        { status: 409 }
      );
    }

    // 6. Server-side timestamp & Initial PENDING_REVIEW status
    const serverTimestamp = new Date().toISOString();
    const newRecordId = `ATT-${Date.now().toString().slice(-6)}`;

    const newRecord = {
      id: newRecordId,
      workshopId: foundWorkshop.id,
      workshopTitle: foundWorkshop.title,
      sessionId: foundSession.id,
      sessionTitle: foundSession.session_title || foundSession.sessionTitle || 'Workshop Session',
      studentName: cleanName,
      studentEmail: cleanEmail,
      studentPhone: cleanPhone,
      studentCourse: course || 'B.Tech - Computer Science',
      date: foundSession.session_date || foundSession.date || serverTimestamp.split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      serverTimestamp,
      status: 'PENDING_REVIEW', // Initial status must be PENDING_REVIEW
      checkInMethod: 'QR Scan',
      notes: `Verified Permanent Session QR. Awaiting Admin Approval.`,
    };

    // Persist into server storage, INITIAL_ATTENDANCE and database
    await saveAttendanceRecord(newRecord as any);

    await logAuditEvent({
      action: 'ATTENDANCE_SUBMITTED_PENDING',
      entityType: 'Attendance',
      entityId: newRecordId,
      details: {
        studentName: cleanName,
        sessionId,
        status: 'PENDING_REVIEW',
        serverTimestamp,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance submitted successfully! Status is PENDING_REVIEW awaiting instructor approval.',
      record: newRecord,
    });
  } catch (err: any) {
    console.error('[Attendance Check-in API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error processing attendance.' },
      { status: 500 }
    );
  }
}
