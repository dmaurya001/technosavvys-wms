import { NextRequest, NextResponse } from 'next/server';
import {
  extractAndValidateSession,
  INACTIVITY_TIMEOUT_MS,
} from '@/lib/sessionManager';
import { INITIAL_STUDENTS } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const result = extractAndValidateSession(request);

  if (!result.valid || !result.session) {
    return NextResponse.json(
      {
        authenticated: false,
        error: result.error || 'Authentication required',
        reason: result.reason || 'invalid',
      },
      { status: 401 }
    );
  }

  const { session } = result;
  const now = Date.now();
  const idleRemainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - (now - session.lastActiveAt));
  const absoluteRemainingMs = Math.max(0, session.expiresAt - now);

  if (session.role === 'teacher') {
    return NextResponse.json({
      authenticated: true,
      role: 'teacher',
      user: {
        sessionId: session.sessionId,
        role: session.role,
        email: session.email,
        name: session.name,
      },
      expiresAt: session.expiresAt,
      idleExpiresAt: session.lastActiveAt + INACTIVITY_TIMEOUT_MS,
      idleRemainingSeconds: Math.floor(idleRemainingMs / 1000),
      absoluteRemainingSeconds: Math.floor(absoluteRemainingMs / 1000),
    });
  }

  // Student Session
  let studentProfile: any = null;
  try {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('id', session.studentId)
      .single();

    if (data) {
      studentProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        regNo: data.reg_no,
        college: data.college,
        batch: data.batch,
      };
    }
  } catch {
    // Fallback
  }

  if (!studentProfile) {
    const mock = INITIAL_STUDENTS.find((s) => s.id === session.studentId);
    studentProfile = mock || {
      id: session.studentId,
      name: session.name,
      email: `${session.name.toLowerCase().replace(/\s+/g, '.')}@student.technosavvys.edu`,
      phone: session.phone,
      regNo: session.regNo,
      college: 'Technosavvys Institute of Technology',
      batch: '2022-2026',
    };
  }

  return NextResponse.json({
    authenticated: true,
    role: 'student',
    user: {
      sessionId: session.sessionId,
      role: session.role,
      studentId: session.studentId,
      name: session.name,
      phone: session.phone,
      regNo: session.regNo,
    },
    student: studentProfile,
    expiresAt: session.expiresAt,
    idleExpiresAt: session.lastActiveAt + INACTIVITY_TIMEOUT_MS,
    idleRemainingSeconds: Math.floor(idleRemainingMs / 1000),
    absoluteRemainingSeconds: Math.floor(absoluteRemainingMs / 1000),
  });
}
