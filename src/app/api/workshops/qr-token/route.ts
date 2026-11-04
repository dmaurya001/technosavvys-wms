import { NextRequest, NextResponse } from 'next/server';
import { getSessionPermanentQrToken } from '@/lib/qrSecurity';
import { INITIAL_WORKSHOPS } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
  verifySessionToken,
} from '@/lib/sessionManager';

export async function GET(request: NextRequest) {
  try {
    // Prevent students from generating or accessing administrative QR tokens
    const studentCookie =
      request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
      request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const tokenToCheck = authHeader || studentCookie;
    if (tokenToCheck) {
      const check = verifySessionToken(tokenToCheck);
      if (check.valid && check.session?.role === 'student') {
        return NextResponse.json(
          { error: 'Forbidden: Students are not authorized to access workshop administrative tokens.' },
          { status: 403 }
        );
      }
    }
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    let workshopId = searchParams.get('workshopId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required.' },
        { status: 400 }
      );
    }

    if (!workshopId) {
      for (const w of INITIAL_WORKSHOPS) {
        if (w.sessions?.some((s) => s.id === sessionId)) {
          workshopId = w.id;
          break;
        }
      }
      if (!workshopId) {
        const raw = sessionId.replace(/^SESS-/, '').replace(/-\d+$/, '');
        workshopId = raw.startsWith('WS-') ? raw : (raw ? `WS-${raw}` : null);
      }
    }

    const resolvedWorkshopId = workshopId || 'default-workshop';
    // Generate one unique, permanent QR token linked to this workshop session
    const token = getSessionPermanentQrToken(resolvedWorkshopId, sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      workshopId: resolvedWorkshopId,
      token,
      isPermanent: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error generating session QR token.' },
      { status: 500 }
    );
  }
}
