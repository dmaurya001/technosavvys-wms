import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import {
  getAllAttendanceRecords,
  updateAttendanceStatusInStore,
  bulkUpdateAttendanceStatusInStore,
} from '@/lib/attendanceStore';
import { AttendanceStatus } from '@/types';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request);
    if (!auth.valid || !auth.session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workshopId = searchParams.get('workshopId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;

    const records = await getAllAttendanceRecords({ workshopId, sessionId });

    // If teacher, return full records
    if (auth.session.role === 'teacher') {
      return NextResponse.json({
        success: true,
        count: records.length,
        attendees: records,
      });
    }

    // If student, filter only their own records to prevent IDOR
    const studentSession = auth.session as any;
    const studentPhone = studentSession.phone ? studentSession.phone.slice(-10) : '';
    const studentRecords = records.filter(
      (r) =>
        (studentSession.studentId && r.studentId === studentSession.studentId) ||
        (studentPhone && r.studentPhone.replace(/\D/g, '').includes(studentPhone))
    );

    return NextResponse.json({
      success: true,
      count: studentRecords.length,
      attendees: studentRecords,
    });
  } catch (err: any) {
    console.error('[API /api/attendance GET Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error fetching attendance.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request);
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ids, status } = body;

    const allowedStatuses: AttendanceStatus[] = [
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'Present',
      'Absent',
      'Late',
      'Excused',
      'CERTIFICATE_ELIGIBLE',
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Allowed: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Handle bulk update
    if (Array.isArray(ids) && ids.length > 0) {
      const count = await bulkUpdateAttendanceStatusInStore(ids, status);
      await logAuditEvent({
        action: 'UPDATE_ATTENDANCE_STATUS_BULK',
        entityType: 'Attendance',
        entityId: ids.join(','),
        details: { count, status, updatedBy: auth.session.email },
      });
      return NextResponse.json({
        success: true,
        count,
        message: `Successfully updated ${count} records to ${status}.`,
      });
    }

    // Handle single update
    if (!id) {
      return NextResponse.json(
        { error: 'Attendance record ID is required.' },
        { status: 400 }
      );
    }

    const updated = await updateAttendanceStatusInStore(id, status);
    if (!updated) {
      return NextResponse.json(
        { error: `Attendance record "${id}" not found.` },
        { status: 404 }
      );
    }

    await logAuditEvent({
      action: 'UPDATE_ATTENDANCE_STATUS',
      entityType: 'Attendance',
      entityId: id,
      details: { status, studentName: updated.studentName, updatedBy: auth.session.email },
    });

    return NextResponse.json({
      success: true,
      record: updated,
      message: `Attendance for ${updated.studentName} updated to ${status}.`,
    });
  } catch (err: any) {
    console.error('[API /api/attendance PATCH Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error updating attendance.' },
      { status: 500 }
    );
  }
}
