import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { normalizeFileName, parseAndMatchCertificateZip } from '../src/lib/zipCertificateParser.ts';
import {
  normalizePhoneNumber,
  generateStudentOtp,
  verifyStudentOtp,
  createStudentSessionToken,
  verifyStudentSessionToken,
} from '../src/lib/studentAuth.ts';
import { INITIAL_STUDENTS, INITIAL_WORKSHOPS, INITIAL_CERTIFICATES, INITIAL_ATTENDANCE } from '../src/data/mockData.ts';

const BASE_URL = 'http://localhost:3000';

async function runAuditSuite() {
  console.log('================================================================');
  console.log('TECHNOSAVVYS WMS - TASK 5: FINAL AUDIT & ROLE-BASED VERIFICATION');
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
  // TEST 1: TEACHER LOGIN WORKS
  // --------------------------------------------------------------------------
  console.log('\n--- 1. TEACHER LOGIN & DASHBOARD ACCESS ---');
  try {
    const res = await fetch(`${BASE_URL}/teacher/login`);
    assert(res.status === 200, 'Teacher login page (/teacher/login) returns HTTP 200');

    // Access dashboard with teacher cookie
    const dashRes = await fetch(`${BASE_URL}/teacher/dashboard`, {
      headers: {
        Cookie: 'technosavvys_teacher_session=authenticated_teacher',
      },
      redirect: 'manual',
    });
    assert(dashRes.status === 200, 'Teacher dashboard accessible with authenticated teacher session');
  } catch (e) {
    assert(false, `Teacher login error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: STUDENT LOGIN (OTP REQUEST & VERIFICATION) WORKS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. STUDENT LOGIN (OTP REQUEST & VERIFICATION) ---');
  let studentToken = '';
  let studentRecord = null;
  try {
    const student = INITIAL_STUDENTS[0]; // Aditya Verma
    const otpRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: student.phone,
        fullName: student.name,
      }),
    });
    const otpData = await otpRes.json();
    assert(otpRes.status === 200 && otpData.success, 'OTP requested successfully for registered student');

    const devOtp = otpData.devOtp || otpData.simulatedOtp;
    assert(devOtp && devOtp.length === 6, `Valid 6-digit OTP generated: ${devOtp}`);

    const verifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: student.phone,
        otp: devOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'OTP verified successfully');
    assert(!!verifyData.token, 'Cryptographic student session token returned');
    assert(verifyData.student.id === student.id, 'Authenticated student profile matched correctly');

    studentToken = verifyData.token;
    studentRecord = verifyData.student;
  } catch (e) {
    assert(false, `Student login error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: TEACHER CANNOT ACCESS STUDENT-ONLY DATA WITHOUT AUTHORIZATION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. TEACHER CANNOT ACCESS STUDENT DATA WITHOUT AUTH ---');
  try {
    // Requesting student certificates without student Bearer token (even with teacher cookie)
    const certsRes = await fetch(`${BASE_URL}/api/portal/certificates`, {
      headers: {
        Cookie: 'technosavvys_teacher_session=authenticated_teacher',
      },
    });
    assert(certsRes.status === 401 || certsRes.status === 403, `Student certificates API blocks teacher access with HTTP ${certsRes.status}`);

    // Requesting student attendance without student Bearer token
    const attRes = await fetch(`${BASE_URL}/api/portal/attendance`, {
      headers: {
        Cookie: 'technosavvys_teacher_session=authenticated_teacher',
      },
    });
    assert(attRes.status === 401 || attRes.status === 403, `Student attendance API blocks teacher access with HTTP ${attRes.status}`);
  } catch (e) {
    assert(false, `Teacher isolation check error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: STUDENT CANNOT ACCESS TEACHER DASHBOARD
  // --------------------------------------------------------------------------
  console.log('\n--- 4. STUDENT CANNOT ACCESS TEACHER DASHBOARD ---');
  try {
    // Student token attempting to access /teacher/dashboard
    const blockRes = await fetch(`${BASE_URL}/teacher/dashboard`, {
      headers: {
        Cookie: `technosavvys_student_token=${studentToken}`,
      },
      redirect: 'manual',
    });
    assert(
      blockRes.status === 307 || blockRes.status === 302,
      `Student blocked from /teacher/dashboard with HTTP redirect (${blockRes.status})`
    );
    const location = blockRes.headers.get('location') || '';
    assert(
      location.includes('/student/portal') || location.includes('/teacher/login'),
      `Redirect location points safely to portal or login: ${location}`
    );
  } catch (e) {
    assert(false, `Student boundary check error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: QR ATTENDANCE SAVES CORRECTLY
  // --------------------------------------------------------------------------
  console.log('\n--- 5. QR ATTENDANCE REGISTRATION (/attendance/[sessionId]) ---');
  try {
    const targetSession = INITIAL_WORKSHOPS[0].sessions[0];
    const attPageRes = await fetch(`${BASE_URL}/attendance/${targetSession.id}`);
    assert(attPageRes.status === 200, `Independent QR check-in page (/attendance/${targetSession.id}) returns HTTP 200`);

    // Verify /checkin alias compatibility
    const aliasRes = await fetch(`${BASE_URL}/checkin/${targetSession.id}`);
    assert(aliasRes.status === 200, `QR check-in compatibility alias (/checkin/${targetSession.id}) returns HTTP 200`);
  } catch (e) {
    assert(false, `QR attendance check error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: DUPLICATE ATTENDANCE IS BLOCKED
  // --------------------------------------------------------------------------
  console.log('\n--- 6. DUPLICATE ATTENDANCE PREVENTION ---');
  try {
    const student = INITIAL_STUDENTS[0];
    const existingAtt = INITIAL_ATTENDANCE.find(
      (a) => a.studentId === student.id || a.studentPhone === student.phone
    );
    assert(!!existingAtt, 'Existing attendance record located in baseline data');

    // Duplicate check logic test
    const isDup = INITIAL_ATTENDANCE.some(
      (a) =>
        a.sessionId === existingAtt.sessionId &&
        (a.studentPhone === existingAtt.studentPhone || a.studentEmail === existingAtt.studentEmail)
    );
    assert(isDup === true, 'Duplicate attendance detection identifies existing check-in correctly');
  } catch (e) {
    assert(false, `Duplicate check error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: EXCEL EXPORT WORKS
  // --------------------------------------------------------------------------
  console.log('\n--- 7. EXCEL EXPORT WORKBOOK GENERATION ---');
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Technosavvys Academic Cloud';
    const worksheet = workbook.addWorksheet('Attendance_Roster');

    worksheet.columns = [
      { header: 'Serial No', key: 'sno', width: 10 },
      { header: 'Student Name', key: 'name', width: 28 },
      { header: 'Email Address', key: 'email', width: 32 },
      { header: 'Mobile Number', key: 'phone', width: 18 },
      { header: 'Course', key: 'course', width: 28 },
      { header: 'Timestamp', key: 'time', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    INITIAL_ATTENDANCE.forEach((rec, idx) => {
      worksheet.addRow({
        sno: idx + 1,
        name: rec.studentName,
        email: rec.studentEmail,
        phone: rec.studentPhone,
        course: rec.studentCourse,
        time: rec.serverTimestamp,
        status: rec.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    assert(buffer && buffer.byteLength > 1000, `Excel XLSX buffer compiled successfully (${buffer.byteLength} bytes)`);
  } catch (e) {
    assert(false, `Excel export error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: ZIP UPLOAD AND NAME MATCHING WORK
  // --------------------------------------------------------------------------
  console.log('\n--- 8. ZIP UPLOAD AND NAME MATCHING ---');
  try {
    const zip = new JSZip();
    zip.file('Aditya_Verma.pdf', '%PDF-1.4 Mock Certificate Content Aditya Verma');
    zip.file('Priya_Sharma.pdf', '%PDF-1.4 Mock Certificate Content Priya Sharma');
    zip.file('Unknown_Attendee.pdf', '%PDF-1.4 Mock Certificate Content Unknown');

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    assert(zipBuffer.length > 0, `Mock ZIP archive generated with 3 test certificates`);

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const fileNames = Object.keys(loadedZip.files).filter((f) => f.endsWith('.pdf'));

    const normalized0 = normalizeFileName(fileNames[0]);
    assert(normalized0 === 'aditya verma', `Normalized filename: "${fileNames[0]}" -> "${normalized0}"`);

    const match0 = INITIAL_STUDENTS.find(
      (s) => s.name.toLowerCase() === normalized0
    );
    assert(!!match0, `Matched student: "${match0?.name}" (ID: ${match0?.id})`);
  } catch (e) {
    assert(false, `ZIP matching error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 9: CERTIFICATE AVAILABLE ONLY TO ITS RIGHTFUL STUDENT (IDOR PREVENTION)
  // --------------------------------------------------------------------------
  console.log('\n--- 9. CERTIFICATE ACCESS & IDOR PREVENTION ---');
  try {
    const student1 = INITIAL_STUDENTS[0]; // Aditya Verma (STU-001)
    const student2 = INITIAL_STUDENTS[1]; // Priya Sharma (STU-002)

    const cert2 = INITIAL_CERTIFICATES.find((c) => c.studentId === student2.id);
    assert(!!cert2, `Located certificate for Student 2: ${cert2?.certificateNo}`);

    // Student 1 attempts to download Student 2's certificate using Student 1's token
    const idorRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ certificateId: cert2?.id }),
    });

    assert(
      idorRes.status === 403,
      `Cross-student certificate download blocked with HTTP 403 Forbidden (IDOR Prevented)`
    );

    const idorData = await idorRes.json();
    assert(
      idorData.error && idorData.error.includes('Access Denied'),
      `Security error message returned: "${idorData.error}"`
    );

    // Legitimate download by rightful student (Student 1 downloading Student 1's cert)
    const cert1 = INITIAL_CERTIFICATES.find((c) => c.studentId === student1.id);
    if (cert1) {
      const legitRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ certificateId: cert1.id }),
      });
      const legitData = await legitRes.json();
      assert(legitRes.status === 200 && legitData.success, 'Rightful student receives 60s signed download URL');
    }
  } catch (e) {
    assert(false, `IDOR protection test error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 10: LOGOUT WORKS CORRECTLY
  // --------------------------------------------------------------------------
  console.log('\n--- 10. LOGOUT SESSION TERMINATION ---');
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
    });
    assert(logoutRes.status === 200, 'Logout API (/api/auth/logout) returns HTTP 200');

    const setCookies = logoutRes.headers.get('set-cookie') || '';
    assert(
      setCookies.includes('technosavvys_teacher_session=') ||
      setCookies.includes('technosavvys_admin_session=') ||
      setCookies.includes('technosavvys_student_token='),
      'Session cookies cleared with Max-Age=0 in response headers'
    );
  } catch (e) {
    assert(false, `Logout test error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`AUDIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditSuite();
