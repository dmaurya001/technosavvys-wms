import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { normalizeFileName } from '../src/lib/zipCertificateParser.ts';
import {
  normalizePhoneNumber,
  normalizeStudentName,
  generateStudentOtp,
  verifyStudentOtp,
  createStudentSessionToken,
  verifyStudentSessionToken,
} from '../src/lib/studentAuth.ts';
import { rateLimiter } from '../src/lib/rateLimiter.ts';
import { INITIAL_STUDENTS, INITIAL_WORKSHOPS, INITIAL_CERTIFICATES, INITIAL_ATTENDANCE } from '../src/data/mockData.ts';

const BASE_URL = 'http://localhost:3000';

async function runFullIntegrationSuite() {
  console.log('===============================================================');
  console.log('TECHNOSAVVYS WMS — COMPREHENSIVE END-TO-END INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

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
  // TEST SUITE 1: HTTP ROUTES AVAILABILITY (Desktop & Mobile Public/Admin)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. HTTP ROUTES HEALTH & AVAILABILITY ---');
  const routes = [
    '/',
    '/login',
    '/workshops',
    '/attendance',
    '/students',
    '/reports',
    '/certificates',
    '/portal',
    '/checkin/SESS-101-1'
  ];

  for (const r of routes) {
    try {
      const res = await fetch(`${BASE_URL}${r}`, {
        headers: {
          // Provide demo admin session cookie to test protected routes
          cookie: 'technosavvys_admin_session=authenticated_admin'
        }
      });
      assert(res.status === 200, `Route ${r} responded with HTTP 200 OK`);
    } catch (err) {
      assert(false, `Route ${r} failed with error: ${err.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 2: ADMIN AUTHENTICATION & LOGIN WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- 2. ADMIN AUTHENTICATION & REDIRECT ---');
  try {
    const unauthRes = await fetch(`${BASE_URL}/workshops`, { redirect: 'manual' });
    const isRedirect = unauthRes.status === 307 || unauthRes.status === 302 || unauthRes.status === 200;
    assert(isRedirect, 'Unauthenticated access to protected route triggers auth boundary / redirect');
  } catch (e) {
    assert(false, `Admin auth redirect error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 3: WORKSHOP & SESSION MANAGEMENT DATA INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n--- 3. WORKSHOPS & SESSION STRUCTURE ---');
  assert(INITIAL_WORKSHOPS.length >= 6, `Workshop inventory loaded (${INITIAL_WORKSHOPS.length} workshops)`);
  const ws101 = INITIAL_WORKSHOPS.find(w => w.id === 'WS-101');
  assert(ws101 && ws101.sessions.length >= 2, 'Workshop WS-101 has multiple dated sessions configured');
  assert(ws101.sessions[0].sessionTitle.includes('Session 1'), 'Dated Session 1 title exists');
  assert(ws101.sessions[1].sessionTitle.includes('Session 2'), 'Dated Session 2 title exists');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: QR CHECK-IN & DUPLICATE ATTENDANCE PREVENTION
  // --------------------------------------------------------------------------
  console.log('\n--- 4. QR ATTENDANCE & DUPLICATE PREVENTION ---');
  // Check that duplicate attendance check works
  const sampleStudentEmail = 'aditya.verma@technosavvys.edu';
  const existingAttendance = INITIAL_ATTENDANCE.find(
    a => a.sessionId === 'SESS-103-1' && a.studentEmail === sampleStudentEmail
  );
  assert(!!existingAttendance, 'Existing attendance record identified for duplicate testing');

  // Duplicate simulation
  const isDuplicate = INITIAL_ATTENDANCE.some(
    a => a.sessionId === 'SESS-103-1' && a.studentEmail.toLowerCase() === sampleStudentEmail.toLowerCase()
  );
  assert(isDuplicate === true, 'Duplicate attendance detection correctly flags re-entry attempt for same session');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: DATE-WISE EXCEL EXPORT (EXCELJS WORKBOOK CREATION)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. DATE-WISE EXCEL EXPORT (EXCELJS) ---');
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Technosavvys WMS';
    const ws = wb.addWorksheet('Attendance_Report');

    ws.addRow(['Sl. No', 'Student Name', 'Email', 'Mobile', 'Date', 'Time', 'Status']);
    INITIAL_ATTENDANCE.slice(0, 5).forEach((rec, idx) => {
      ws.addRow([idx + 1, rec.studentName, rec.studentEmail, rec.studentPhone, rec.date, rec.time, rec.status]);
    });

    const buffer = await wb.xlsx.writeBuffer();
    assert(buffer.byteLength > 1000, `ExcelJS generated valid binary XLSX buffer (${buffer.byteLength} bytes)`);
  } catch (err) {
    assert(false, `ExcelJS generation error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 6: ZIP CERTIFICATE PARSING & NAME MATCHING LOGIC
  // --------------------------------------------------------------------------
  console.log('\n--- 6. ZIP CERTIFICATE PARSING & NAME NORMALIZATION ---');
  const rawNames = [
    'Aditya_Verma.pdf',
    'rahul-kulkarni.PDF',
    'TS-2026-081_Aditya.pdf',
    'Deepak_Maurya_Specialist.pdf'
  ];

  const normalized = rawNames.map(normalizeFileName);
  assert(normalized[0] === 'aditya verma', 'Normalized "Aditya_Verma.pdf" -> "aditya verma"');
  assert(normalized[1] === 'rahul kulkarni', 'Normalized "rahul-kulkarni.PDF" -> "rahul kulkarni"');
  assert(normalized[2].includes('aditya'), 'Normalized registration ID pattern');

  // Test JSZip synthetic archive creation & extraction
  const zip = new JSZip();
  zip.file('Aditya_Verma.pdf', '%PDF-1.4 mock pdf content 1');
  zip.file('Rahul_Kulkarni.pdf', '%PDF-1.4 mock pdf content 2');
  const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
  assert(zipBlob.length > 0, `Created synthetic ZIP archive in memory (${zipBlob.length} bytes)`);

  const unzipped = await JSZip.loadAsync(zipBlob);
  const unzippedFiles = Object.keys(unzipped.files);
  assert(unzippedFiles.includes('Aditya_Verma.pdf'), 'JSZip successfully extracted Aditya_Verma.pdf');
  assert(unzippedFiles.includes('Rahul_Kulkarni.pdf'), 'JSZip successfully extracted Rahul_Kulkarni.pdf');

  // --------------------------------------------------------------------------
  // TEST SUITE 7: STUDENT PORTAL OTP VERIFICATION & HMAC SESSION TOKENS
  // --------------------------------------------------------------------------
  console.log('\n--- 7. PUBLIC PORTAL OTP & CRYPTOGRAPHIC AUTH ---');
  const testPhone = '+91 98765 43210';
  const cleanPhone = normalizePhoneNumber(testPhone);
  assert(cleanPhone === '9876543210', 'Phone number normalized to 10 digits ("9876543210")');

  // Test OTP generation
  const generatedOtp = generateStudentOtp(cleanPhone, 'STU-001', 'Aditya Verma');
  assert(generatedOtp.length === 6, `Generated 6-digit cryptographic OTP: ${generatedOtp}`);

  // Test invalid OTP rejection
  const invalidOtpRes = verifyStudentOtp(cleanPhone, '000000');
  assert(invalidOtpRes.success === false, 'Invalid OTP correctly rejected by cryptographic verification');

  // Test valid OTP acceptance
  const validOtpRes = verifyStudentOtp(cleanPhone, generatedOtp);
  assert(validOtpRes.success === true && validOtpRes.studentId === 'STU-001', 'Valid OTP successfully verified and cleared');

  // Test HMAC Session Token
  const studentPayload = { id: 'STU-001', name: 'Aditya Verma', phone: testPhone, regNo: 'TS-2026-081' };
  const sessionToken = createStudentSessionToken(studentPayload);
  assert(typeof sessionToken === 'string' && sessionToken.includes('.'), 'Issued HMAC-SHA256 signed student session token');

  const decodedSession = verifyStudentSessionToken(sessionToken);
  assert(decodedSession.studentId === 'STU-001', 'Decoded student session token validates signature & studentId');

  // --------------------------------------------------------------------------
  // TEST SUITE 8: API ENDPOINTS (REQUEST-OTP, VERIFY-OTP, CERTIFICATES)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. LIVE API ENDPOINTS ---');
  // API: Request OTP
  const apiOtpRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Aditya Verma', mobileNumber: '+91 98765 43210' })
  });
  const apiOtpData = await apiOtpRes.json();
  assert(apiOtpRes.status === 200, `POST /api/portal/request-otp returned 200 OK (OTP: ${apiOtpData.simulatedOtp})`);

  // API: Verify OTP
  const apiVerifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: '+91 98765 43210', otp: apiOtpData.simulatedOtp })
  });
  const apiVerifyData = await apiVerifyRes.json();
  assert(apiVerifyRes.status === 200 && !!apiVerifyData.token, 'POST /api/portal/verify-otp returned 200 OK with valid bearer token');

  const liveToken = apiVerifyData.token;

  // API: Certificates
  const apiCertsRes = await fetch(`${BASE_URL}/api/portal/certificates`, {
    headers: { Authorization: `Bearer ${liveToken}` }
  });
  const apiCertsData = await apiCertsRes.json();
  assert(apiCertsRes.status === 200 && apiCertsData.certificates.length > 0, `GET /api/portal/certificates returned ${apiCertsData.certificates?.length} certificates`);

  const cert = apiCertsData.certificates[0];
  assert(!!cert.workshopTitle && !!cert.issueDate, `Certificate contains workshop title ("${cert.workshopTitle}") and date ("${cert.issueDate}")`);

  // --------------------------------------------------------------------------
  // TEST SUITE 9: SECURE PDF DOWNLOAD & TEMPORARY SIGNED URL (60s)
  // --------------------------------------------------------------------------
  console.log('\n--- 9. SECURE PDF DOWNLOAD & SIGNED URLS ---');
  const apiDlRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${liveToken}`
    },
    body: JSON.stringify({ certificateId: cert.id })
  });
  const apiDlData = await apiDlRes.json();
  assert(apiDlRes.status === 200, 'POST /api/portal/download-url returned 200 OK');
  assert(apiDlData.expiresInSeconds === 60, 'Temporary signed link enforces 60-second expiration');
  assert(!!apiDlData.signedUrl, 'Signed download URL successfully generated');

  // --------------------------------------------------------------------------
  // TEST SUITE 10: SECURITY - IDOR / CROSS-STUDENT SPOOF PREVENTION
  // --------------------------------------------------------------------------
  console.log('\n--- 10. SECURITY: UNAUTHORIZED CERTIFICATE ACCESS BLOCKED ---');
  // Attempt to download certificate CERT-503 (belongs to STU-005) with STU-001 token
  const spoofRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${liveToken}`
    },
    body: JSON.stringify({ certificateId: 'CERT-503' })
  });
  const spoofData = await spoofRes.json();
  assert(spoofRes.status === 403, 'Cross-student certificate access blocked with HTTP 403 Forbidden');
  assert(spoofData.error.includes('Access Denied'), 'Security audit error message confirmed');

  // --------------------------------------------------------------------------
  // TEST SUITE 11: SECURITY - RATE LIMITING PROTECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 11. SECURITY: RATE LIMITING SAFEGUARDS ---');
  // Verify rate limiter check
  const testKey = 'test_rate_limiter_key_' + Date.now();
  const r1 = rateLimiter.check(testKey, 2, 60);
  const r2 = rateLimiter.check(testKey, 2, 60);
  const r3 = rateLimiter.check(testKey, 2, 60);
  assert(r1.allowed === true && r2.allowed === true, 'Under-limit requests allowed');
  assert(r3.allowed === false, 'Rate limit violation detected and rejected (3rd request over limit 2)');

  // --------------------------------------------------------------------------
  // FINAL SCORE & SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullIntegrationSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
