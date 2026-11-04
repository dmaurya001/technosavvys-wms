import fs from 'fs';
import path from 'path';
import {
  createTeacherSession,
  createStudentSession,
  verifySessionToken,
  revokeSession,
  isSessionRevoked,
  INACTIVITY_TIMEOUT_MS,
  TEACHER_ABSOLUTE_EXPIRY_MS,
  STUDENT_ABSOLUTE_EXPIRY_MS,
} from '../src/lib/sessionManager.ts';
import { verifyEdgeSessionToken } from '../src/lib/edgeSession.ts';
import { INITIAL_STUDENTS, INITIAL_WORKSHOPS } from '../src/data/mockData.ts';
import { getSessionPermanentQrToken } from '../src/lib/qrSecurity.ts';

const BASE_URL = 'http://localhost:3000';

async function runAuthAndSessionSuite() {
  console.log('================================================================');
  console.log('TECHNOSAVVYS WMS - COMPLETE AUTH & SESSION SECURITY VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. SEPARATE TEACHER AUTHENTICATION (POST /api/auth/teacher-login)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. TEACHER AUTHENTICATION & SECURE COOKIES ---');
  
  // Invalid credentials rejected
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@technosavvys.edu', password: 'wrongpassword' }),
  });
  assert(badLoginRes.status === 401, 'Invalid teacher credentials rejected with HTTP 401');

  // Valid credentials approved
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'techno3deepak@gmail.com', password: 'Deepak@8960@techno' }),
  });
  assert(teacherLoginRes.status === 200, 'Valid teacher credentials approved with HTTP 200');

  const teacherData = await teacherLoginRes.json();
  assert(teacherData.success && teacherData.teacher.role === 'teacher', 'Teacher session object has role: "teacher"');

  const teacherSetCookie = teacherLoginRes.headers.get('set-cookie') || '';
  assert(teacherSetCookie.includes('technosavvys_teacher_session='), 'Teacher response sets "technosavvys_teacher_session" cookie');
  assert(teacherSetCookie.toLowerCase().includes('httponly'), 'Teacher session cookie is strictly HttpOnly');
  assert(teacherSetCookie.toLowerCase().includes('samesite=lax'), 'Teacher session cookie is SameSite=Lax');

  // Extract raw cookie string for subsequent tests
  const teacherCookieHeader = teacherSetCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .join('; ');

  // --------------------------------------------------------------------------
  // 2. SEPARATE STUDENT AUTHENTICATION (POST /api/portal/verify-otp)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. STUDENT AUTHENTICATION & SECURE COOKIES ---');
  const demoStudent = INITIAL_STUDENTS[0];

  // Request OTP
  const otpReqRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: demoStudent.name,
      mobileNumber: demoStudent.phone,
    }),
  });
  const otpReqData = await otpReqRes.json();
  const devOtp = otpReqData.devOtp || otpReqData.simulatedOtp;
  assert(otpReqRes.status === 200 && devOtp, 'Student OTP requested successfully');

  // Bad OTP rejected
  const badOtpRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: demoStudent.phone, otp: '000000' }),
  });
  assert(badOtpRes.status === 400, 'Incorrect OTP rejected with HTTP 400');

  // Correct OTP verified
  const studentVerifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: demoStudent.phone, otp: devOtp }),
  });
  assert(studentVerifyRes.status === 200, 'Correct OTP verified with HTTP 200');

  const studentData = await studentVerifyRes.json();
  assert(studentData.success && studentData.student.id === demoStudent.id, 'Student session created for authenticated student ID');

  const studentSetCookie = studentVerifyRes.headers.get('set-cookie') || '';
  assert(studentSetCookie.includes('technosavvys_student_session='), 'Student response sets "technosavvys_student_session" cookie');
  assert(studentSetCookie.toLowerCase().includes('httponly'), 'Student session cookie is strictly HttpOnly');
  assert(studentSetCookie.toLowerCase().includes('samesite=lax'), 'Student session cookie is SameSite=Lax');

  const studentCookieHeader = studentSetCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .join('; ');

  // --------------------------------------------------------------------------
  // 3. SERVER-SIDE SESSION VALIDATION (GET /api/auth/me)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. SERVER-SIDE SESSION VALIDATION (/api/auth/me) ---');

  // Unauthenticated request
  const unauthMeRes = await fetch(`${BASE_URL}/api/auth/me`);
  assert(unauthMeRes.status === 401, 'Unauthenticated /api/auth/me returns HTTP 401');

  // Teacher session validation
  const teacherMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: teacherCookieHeader },
  });
  const teacherMeData = await teacherMeRes.json();
  assert(teacherMeRes.status === 200 && teacherMeData.authenticated && teacherMeData.role === 'teacher', 'Server validates teacher session and reports role: "teacher"');
  assert(teacherMeData.idleRemainingSeconds <= 900, 'Reports 15-minute idle inactivity remaining time');
  assert(teacherMeData.absoluteRemainingSeconds <= 28800, 'Reports 8-hour absolute expiry remaining time');

  // Student session validation
  const studentMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: studentCookieHeader },
  });
  const studentMeData = await studentMeRes.json();
  assert(studentMeRes.status === 200 && studentMeData.authenticated && studentMeData.role === 'student', 'Server validates student session and reports role: "student"');
  assert(studentMeData.absoluteRemainingSeconds <= 7200, 'Reports 2-hour student absolute expiry remaining time');

  // --------------------------------------------------------------------------
  // 4. 15-MINUTE INACTIVITY TIMEOUT VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 4. 15-MINUTE INACTIVITY TIMEOUT ---');

  // Active session
  const { token: activeToken } = createTeacherSession('instructor@technosavvys.edu', 'Active Teacher');
  const activeCheck = verifySessionToken(activeToken);
  assert(activeCheck.valid === true, 'Recently active session validates successfully');

  // Inactive session (lastActiveAt simulated 16 minutes ago)
  const now = Date.now();
  const inactiveSession = {
    sessionId: 'sess_inactive_123',
    role: 'teacher',
    email: 'inactive@technosavvys.edu',
    name: 'Inactive Teacher',
    createdAt: now - 30 * 60 * 1000,
    lastActiveAt: now - 16 * 60 * 1000, // 16 minutes ago (>15 min idle)
    expiresAt: now + 7 * 60 * 60 * 1000,
  };
  const inactiveToken = createTeacherSession('test@test.com').token;
  // Craft signed inactive token
  const crypto = await import('crypto');
  const secret = process.env.SESSION_SECRET || 'technosavvys-master-session-security-secret-key-2026';
  const inactivePayloadB64 = Buffer.from(JSON.stringify(inactiveSession)).toString('base64url');
  const inactiveSig = crypto.createHmac('sha256', secret).update(inactivePayloadB64).digest('base64url');
  const fullInactiveToken = `${inactivePayloadB64}.${inactiveSig}`;

  const inactiveResult = verifySessionToken(fullInactiveToken);
  assert(inactiveResult.valid === false && inactiveResult.reason === 'idle_timeout', '16-minute inactive session rejected with reason: "idle_timeout"');

  const edgeInactiveResult = await verifyEdgeSessionToken(fullInactiveToken);
  assert(edgeInactiveResult.valid === false && edgeInactiveResult.reason === 'idle_timeout', 'Edge runtime session validator rejects inactive session');

  // Ping endpoint refreshes lastActiveAt
  const pingRes = await fetch(`${BASE_URL}/api/auth/ping`, {
    method: 'POST',
    headers: { Cookie: teacherCookieHeader },
  });
  const pingData = await pingRes.json();
  assert(pingRes.status === 200 && pingData.valid, 'Active session keepalive ping (/api/auth/ping) updates lastActiveAt');

  // --------------------------------------------------------------------------
  // 5. ABSOLUTE SESSION EXPIRY (8h Teacher, 2h Student)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. ABSOLUTE SESSION EXPIRIES ---');

  // Teacher session created 8.5 hours ago
  const expiredTeacherSession = {
    sessionId: 'sess_tch_exp_123',
    role: 'teacher',
    email: 'teacher@technosavvys.edu',
    name: 'Teacher',
    createdAt: now - (8.5 * 60 * 60 * 1000),
    lastActiveAt: now - (2 * 60 * 1000), // active recently
    expiresAt: now - (0.5 * 60 * 60 * 1000), // expired 30 mins ago
  };
  const expTchB64 = Buffer.from(JSON.stringify(expiredTeacherSession)).toString('base64url');
  const expTchSig = crypto.createHmac('sha256', secret).update(expTchB64).digest('base64url');
  const expiredTeacherToken = `${expTchB64}.${expTchSig}`;

  const teacherExpiryResult = verifySessionToken(expiredTeacherToken);
  assert(teacherExpiryResult.valid === false && teacherExpiryResult.reason === 'expired', 'Teacher session exceeding 8-hour limit is strictly expired');

  // Student session created 2.5 hours ago
  const expiredStudentSession = {
    sessionId: 'sess_stu_exp_123',
    role: 'student',
    studentId: 'STU-001',
    name: 'Student',
    phone: '9876543210',
    regNo: 'REG-001',
    createdAt: now - (2.5 * 60 * 60 * 1000),
    lastActiveAt: now - (1 * 60 * 1000), // active recently
    expiresAt: now - (0.5 * 60 * 60 * 1000), // expired 30 mins ago
  };
  const expStuB64 = Buffer.from(JSON.stringify(expiredStudentSession)).toString('base64url');
  const expStuSig = crypto.createHmac('sha256', secret).update(expStuB64).digest('base64url');
  const expiredStudentToken = `${expStuB64}.${expStuSig}`;

  const studentExpiryResult = verifySessionToken(expiredStudentToken);
  assert(studentExpiryResult.valid === false && studentExpiryResult.reason === 'expired', 'Student session exceeding 2-hour limit is strictly expired');

  // --------------------------------------------------------------------------
  // 6. IMMEDIATE SERVER-SIDE LOGOUT & SESSION INVALIDATION
  // --------------------------------------------------------------------------
  console.log('\n--- 6. IMMEDIATE LOGOUT & REVOCATION ---');

  // Create temporary student session to revoke
  const { token: tokenToRevoke, session: sessionToRevoke } = createStudentSession(demoStudent);
  assert(verifySessionToken(tokenToRevoke).valid === true, 'Session is valid before logout');

  // Revoke session server-side
  revokeSession(sessionToRevoke.sessionId);
  assert(isSessionRevoked(sessionToRevoke.sessionId) === true, 'Session ID marked revoked server-side');

  const revokedCheck = verifySessionToken(tokenToRevoke);
  assert(revokedCheck.valid === false && revokedCheck.reason === 'revoked', 'Revoked session is rejected immediately with reason: "revoked"');

  // Test /api/auth/logout API endpoint
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: studentCookieHeader },
  });
  assert(logoutRes.status === 200, 'Logout endpoint returns HTTP 200');

  const logoutSetCookie = logoutRes.headers.get('set-cookie') || '';
  assert(logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('max-age=0'), 'Logout clears cookies with Max-Age=0');

  // --------------------------------------------------------------------------
  // 7. ROLE SEPARATION & CROSS-ROLE AUTHORIZATION RESTRICTIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 7. ROLE-BASED ACCESS CONTROL & BOUNDARIES ---');

  // Fresh active student session
  const { token: activeStudentSessionToken } = createStudentSession(demoStudent);

  // Student trying to access teacher-only API (/api/workshops/qr-token)
  const studentHackingTeacherApi = await fetch(
    `${BASE_URL}/api/workshops/qr-token?sessionId=SESS-001`,
    {
      headers: { Cookie: `technosavvys_student_session=${activeStudentSessionToken}` },
    }
  );
  assert(studentHackingTeacherApi.status === 403, 'Student blocked with HTTP 403 when accessing administrative workshop token API');

  // Teacher trying to access student portal endpoints without student credentials
  const teacherAccessingStudentAttendance = await fetch(
    `${BASE_URL}/api/portal/attendance`,
    {
      headers: { Cookie: teacherCookieHeader },
    }
  );
  assert(teacherAccessingStudentAttendance.status === 403, 'Teacher blocked with HTTP 403 when accessing student portal attendance without student auth');

  const teacherAccessingStudentCertificates = await fetch(
    `${BASE_URL}/api/portal/certificates`,
    {
      headers: { Cookie: teacherCookieHeader },
    }
  );
  assert(teacherAccessingStudentCertificates.status === 403, 'Teacher blocked with HTTP 403 when accessing student certificates without student auth');

  const teacherAccessingStudentDownload = await fetch(
    `${BASE_URL}/api/portal/download-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teacherCookieHeader },
      body: JSON.stringify({ certificateId: 'CERT-001' }),
    }
  );
  assert(teacherAccessingStudentDownload.status === 403, 'Teacher blocked with HTTP 403 when attempting to download student certificate without student auth');

  // --------------------------------------------------------------------------
  // 8. NO TOKENS IN LOCALSTORAGE VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 8. NO TOKENS IN LOCALSTORAGE ---');
  const studentLoginSource = fs.readFileSync(path.join(process.cwd(), 'src/app/student/login/page.tsx'), 'utf8');
  const studentPortalSource = fs.readFileSync(path.join(process.cwd(), 'src/app/student/portal/page.tsx'), 'utf8');

  assert(!studentLoginSource.includes("localStorage.setItem('technosavvys_student_token'"), 'student/login/page.tsx has ZERO localStorage token storage');
  assert(!studentPortalSource.includes("localStorage.getItem('technosavvys_student_token'"), 'student/portal/page.tsx has ZERO localStorage token retrieval');

  // --------------------------------------------------------------------------
  // 9. PUBLIC QR ATTENDANCE REMAINS INDEPENDENT
  // --------------------------------------------------------------------------
  console.log('\n--- 9. PUBLIC QR ATTENDANCE INDEPENDENCE ---');
  const targetWs = INITIAL_WORKSHOPS[0];
  const targetSess = targetWs.sessions[0];
  const permanentQrToken = getSessionPermanentQrToken(targetWs.id, targetSess.id);

  const checkInRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: targetSess.id,
      token: permanentQrToken,
      fullName: 'Autonomous Candidate ' + Date.now(),
      email: `auto_${Date.now()}@technosavvys.edu`,
      phone: `98${Date.now().toString().slice(-8)}`,
      course: 'B.Tech CS',
    }),
  });
  const checkInData = await checkInRes.json();
  assert(checkInRes.status === 200 && checkInData.success, 'Public QR attendance registers independently without requiring prior portal login');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`AUTH & SESSION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthAndSessionSuite();
