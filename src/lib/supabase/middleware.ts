import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  verifyEdgeSessionToken,
  TEACHER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  STUDENT_COOKIE_NAME,
  LEGACY_STUDENT_COOKIE_NAME,
} from '@/lib/edgeSession';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://technosavvys-wms.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock_anon_key';

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Static assets and internal next routes bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return supabaseResponse;
  }

  // 1. Check Teacher / Admin session
  const teacherToken =
    request.cookies.get(TEACHER_COOKIE_NAME)?.value ||
    request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  let isTeacherAuthenticated = false;
  let teacherSessionError: string | null = null;

  if (teacherToken) {
    const check = await verifyEdgeSessionToken(teacherToken);
    if (check.valid && check.role === 'teacher') {
      isTeacherAuthenticated = true;
    } else {
      teacherSessionError =
        check.reason === 'idle_timeout'
          ? 'session_idle_timeout'
          : check.reason === 'expired'
          ? 'session_expired'
          : check.reason === 'revoked'
          ? 'session_revoked'
          : null;
    }
  }

  // Supabase Auth fallback
  if (!isTeacherAuthenticated) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        isTeacherAuthenticated = true;
      }
    } catch {
      // Fall back to cookie check
    }
  }

  // 2. Check Student session token
  const studentToken =
    request.cookies.get(STUDENT_COOKIE_NAME)?.value ||
    request.cookies.get(LEGACY_STUDENT_COOKIE_NAME)?.value;

  let isStudentAuthenticated = false;
  let studentSessionError: string | null = null;

  if (studentToken) {
    const check = await verifyEdgeSessionToken(studentToken);
    if (check.valid && check.role === 'student') {
      isStudentAuthenticated = true;
    } else {
      studentSessionError =
        check.reason === 'idle_timeout'
          ? 'session_idle_timeout'
          : check.reason === 'expired'
          ? 'session_expired'
          : check.reason === 'revoked'
          ? 'session_revoked'
          : null;
    }
  }

  // Public routes
  const isRoot = pathname === '/';
  const isCommonLogin = pathname === '/login';
  const isTeacherLogin = pathname === '/teacher/login';
  const isStudentLogin = pathname === '/student/login';
  const isPublicAttendance = pathname.startsWith('/attendance') || pathname.startsWith('/checkin');
  const isPublicCertificates = pathname.startsWith('/certificates');
  const isLegacyPortal = pathname === '/portal';

  // Handle Root route "/" & Common Login "/login" -> Always present Login Selection Gateway
  if (isRoot || isCommonLogin) {
    return supabaseResponse;
  }

  // Legacy portal alias redirect
  if (isLegacyPortal) {
    const url = request.nextUrl.clone();
    url.pathname = '/student/portal';
    return NextResponse.redirect(url);
  }

  // Public Attendance & Public Certificates routes are always accessible
  if (isPublicAttendance || isPublicCertificates) {
    return supabaseResponse;
  }

  // Protect Teacher / Admin Routes
  const isTeacherRoute =
    pathname.startsWith('/teacher/dashboard') ||
    pathname === '/teacher' ||
    pathname.startsWith('/workshops') ||
    (pathname.startsWith('/attendance') && !isPublicAttendance) ||
    pathname.startsWith('/students') ||
    pathname.startsWith('/reports');

  if (isTeacherRoute) {
    // If student tries to access teacher dashboard: block and redirect to student portal
    if (isStudentAuthenticated && !isTeacherAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/student/portal';
      url.searchParams.set('error', 'unauthorized_teacher_resource');
      return NextResponse.redirect(url);
    }

    // If unauthenticated or expired: redirect to teacher login
    if (!isTeacherAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/teacher/login';
      if (teacherSessionError) {
        url.searchParams.set('error', teacherSessionError);
      }
      url.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(url);
      if (teacherSessionError) {
        res.cookies.set(TEACHER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
        res.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return res;
    }
  }

  // Protect Student Portal
  if (pathname.startsWith('/student/portal')) {
    // If teacher tries to access student portal: block and redirect to teacher dashboard
    if (isTeacherAuthenticated && !isStudentAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/teacher/dashboard';
      url.searchParams.set('error', 'unauthorized_student_resource');
      return NextResponse.redirect(url);
    }

    if (!isStudentAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/student/login';
      if (studentSessionError) {
        url.searchParams.set('error', studentSessionError);
      }
      url.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(url);
      if (studentSessionError) {
        res.cookies.set(STUDENT_COOKIE_NAME, '', { path: '/', maxAge: 0 });
        res.cookies.set(LEGACY_STUDENT_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return res;
    }
  }

  // If already authenticated teacher visits teacher login, redirect to dashboard
  if (isTeacherLogin && isTeacherAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/teacher/dashboard';
    return NextResponse.redirect(url);
  }

  // If already authenticated student visits student login, redirect to portal
  if (isStudentLogin && isStudentAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/student/portal';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
