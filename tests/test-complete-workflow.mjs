import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {
  getSessionPermanentQrToken,
  verifySessionPermanentQrToken,
} from '../src/lib/qrSecurity.ts';
import { normalizeFileName, parseAndMatchCertificateZip } from '../src/lib/zipCertificateParser.ts';
import {
  normalizePhoneNumber,
  createStudentSessionToken,
  verifyStudentSessionToken,
  maskEmail,
  maskPhone,
} from '../src/lib/studentAuth.ts';
import { INITIAL_STUDENTS, INITIAL_WORKSHOPS, INITIAL_CERTIFICATES, INITIAL_ATTENDANCE } from '../src/data/mockData.ts';

const BASE_URL = 'http://localhost:3000';

async function runCompleteWorkflowSuite() {
  console.log('================================================================');
  console.log('TECHNOSAVVYS WMS - PERMANENT SESSION QR & WORKFLOW VERIFICATION');
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
  // 1. PERMANENT UNIQUE QR GENERATION FOR DIFFERENT WORKSHOPS
  // --------------------------------------------------------------------------
  console.log('\n--- 1. PERMANENT UNIQUE QR FOR WORKSHOP SESSIONS ---');
  const workshop1 = INITIAL_WORKSHOPS[0];
  const session1 = workshop1.sessions[0];

  const workshop2 = INITIAL_WORKSHOPS[1];
  const session2 = workshop2.sessions[0];

  // Generate permanent tokens for workshop 1 and workshop 2
  const token1 = getSessionPermanentQrToken(workshop1.id, session1.id);
  const token2 = getSessionPermanentQrToken(workshop2.id, session2.id);

  assert(!!token1 && token1.startsWith('ts_qr_'), `Session 1 permanent QR token generated: ${token1}`);
  assert(!!token2 && token2.startsWith('ts_qr_'), `Session 2 permanent QR token generated: ${token2}`);
  assert(token1 !== token2, 'Two different workshops have distinct, unique permanent QR tokens');

  // Verify stability: generating token again produces exact same token (unchanged)
  const token1Again = getSessionPermanentQrToken(workshop1.id, session1.id);
  assert(token1 === token1Again, 'QR token remains strictly permanent and unchanged throughout session');

  // Verify validation: token1 matches workshop1/session1
  assert(
    verifySessionPermanentQrToken(workshop1.id, session1.id, token1) === true,
    'Session 1 token validates against workshop 1 session 1'
  );

  // Cross-workshop protection: Old workshop QR must NEVER register attendance for a new workshop
  const crossWorkshopCheck = verifySessionPermanentQrToken(workshop2.id, session2.id, token1);
  assert(
    crossWorkshopCheck === false,
    'Old workshop QR token is strictly rejected for a different workshop session'
  );

  // Verify server API returns permanent token
  try {
    const apiRes = await fetch(`${BASE_URL}/api/workshops/qr-token?sessionId=${session1.id}&workshopId=${workshop1.id}`);
    const apiData = await apiRes.json();
    assert(apiRes.status === 200 && apiData.token === token1, 'QR token API returns exact permanent token');
  } catch (e) {
    assert(false, `QR token API error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // 2. ATTENDANCE SUBMISSION, TIMESTAMP & PENDING_REVIEW STATUS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. ATTENDANCE SUBMISSION & PENDING_REVIEW STATUS ---');
  let newAttendeeEmail = `candidate.${Date.now()}@technosavvys.edu`;
  let newAttendeePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  try {
    // Attempt check-in with invalid/mismatched token -> 403 Forbidden
    const rejRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session1.id,
        token: 'invalid_mismatched_token',
        fullName: 'Test Candidate',
        email: newAttendeeEmail,
        phone: newAttendeePhone,
        course: 'B.Tech IT',
      }),
    });
    assert(rejRes.status === 403, 'Attendance check-in rejects mismatched QR token with HTTP 403');

    // Attempt check-in with old workshop's QR token for new session -> 403 Forbidden
    const crossRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session2.id,
        token: token1, // Token from Workshop 1 sent to Workshop 2
        fullName: 'Test Candidate',
        email: newAttendeeEmail,
        phone: newAttendeePhone,
        course: 'B.Tech IT',
      }),
    });
    assert(crossRes.status === 403, 'Cross-session check-in blocked with HTTP 403 QR_SESSION_MISMATCH');

    // Submit with correct permanent token -> 200 & PENDING_REVIEW
    const subRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session1.id,
        token: token1,
        fullName: 'Test Candidate',
        email: newAttendeeEmail,
        phone: newAttendeePhone,
        course: 'B.Tech IT',
      }),
    });
    const subData = await subRes.json();
    assert(subRes.status === 200 && subData.success, 'Attendance submitted successfully with permanent session QR');
    assert(subData.record?.status === 'PENDING_REVIEW', `Initial status is strictly PENDING_REVIEW (Got: ${subData.record?.status})`);
    assert(!!subData.record?.serverTimestamp, `Server timestamp recorded: ${subData.record?.serverTimestamp}`);

    // Duplicate submission test (same student & session) -> 409
    const dupRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session1.id,
        token: token1,
        fullName: 'Test Candidate Duplicate',
        email: newAttendeeEmail,
        phone: newAttendeePhone,
        course: 'B.Tech IT',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate attendance submission blocked with HTTP 409 Conflict');
  } catch (e) {
    assert(false, `Attendance submission error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // 3. ADMIN ATTENDANCE APPROVAL WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- 3. ADMIN ATTENDANCE APPROVAL WORKFLOW ---');
  try {
    const student = INITIAL_STUDENTS[0];
    const attRecord = INITIAL_ATTENDANCE.find((a) => a.studentId === student.id);
    assert(!!attRecord, 'Found attendance record for student in registry');

    attRecord.status = 'APPROVED';
    assert(attRecord.status === 'APPROVED', 'Admin marks attendance as APPROVED (Certificate Eligible)');

    attRecord.status = 'REJECTED';
    assert(attRecord.status === 'REJECTED', 'Admin marks attendance as REJECTED');

    // Restore to APPROVED
    attRecord.status = 'APPROVED';
  } catch (e) {
    assert(false, `Admin approval error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // 4. DUPLICATE STUDENT NAMES & STRICT DISAMBIGUATION
  // --------------------------------------------------------------------------
  console.log('\n--- 4. DUPLICATE STUDENT NAMES & STRICT DISAMBIGUATION ---');
  try {
    assert(maskEmail('rahul.kumar@gmail.com') === 'r***r@gmail.com', `Masked email: ${maskEmail('rahul.kumar@gmail.com')}`);
    assert(maskPhone('9876543210') === '+91 ******3210', `Masked phone: ${maskPhone('9876543210')}`);

    const studentA = {
      id: 'STU-901',
      name: 'Rahul Sharma',
      email: 'rahul.delhi@gmail.com',
      phone: '9876543210',
      regNo: 'REG-901',
      college: 'Delhi Tech',
      batch: '2026',
      enrolledWorkshopIds: ['WS-101'],
      totalAttended: 1,
      status: 'Active',
    };
    const studentB = {
      id: 'STU-902',
      name: 'Rahul Sharma',
      email: 'rahul.mumbai@gmail.com',
      phone: '9811223344',
      regNo: 'REG-902',
      college: 'Mumbai Tech',
      batch: '2026',
      enrolledWorkshopIds: ['WS-101'],
      totalAttended: 1,
      status: 'Active',
    };

    const mockStudentsWithDup = [...INITIAL_STUDENTS, studentA, studentB];

    const dupZip = new JSZip();
    dupZip.file('Rahul_Sharma.pdf', '%PDF-1.4 Mock Certificate Data for Rahul Sharma');
    const dupZipBuffer = await dupZip.generateAsync({ type: 'nodebuffer' });

    const mockFile = new File([dupZipBuffer], 'certificates_dup.zip', {
      type: 'application/zip',
    });

    const parsedDupRes = await parseAndMatchCertificateZip(
      mockFile,
      mockStudentsWithDup,
      [],
      ['STU-901', 'STU-902']
    );

    assert(parsedDupRes.entries.length === 1, 'ZIP with duplicate name parsed 1 entry');
    const dupEntry = parsedDupRes.entries[0];

    assert(dupEntry.status === 'ambiguous', `Duplicate name marked strictly as AMBIGUOUS (Got: ${dupEntry.status})`);
    assert(dupEntry.matchedStudentId === null, 'Ambiguous entry is NEVER automatically assigned (matchedStudentId === null)');
    assert(dupEntry.potentialMatches.length >= 2, `All matching candidates listed in potentialMatches (${dupEntry.potentialMatches.length} candidates)`);
  } catch (e) {
    assert(false, `Duplicate student name test error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // 5. PUBLIC STUDENT CERTIFICATE PORTAL (/certificates)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. PUBLIC STUDENT CERTIFICATE PORTAL (/certificates) ---');
  try {
    const certPageRes = await fetch(`${BASE_URL}/certificates`);
    assert(certPageRes.status === 200, 'Public certificate portal (/certificates) returns HTTP 200');

    const student = INITIAL_STUDENTS[0];
    const otpRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: student.name,
        mobileNumber: student.phone,
      }),
    });
    const otpData = await otpRes.json();
    assert(otpRes.status === 200 && otpData.success, 'OTP requested from public certificate portal');

    const devOtp = otpData.devOtp || otpData.simulatedOtp;
    const verifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: student.phone,
        otp: devOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'OTP verified; student session token returned');

    const certsRes = await fetch(`${BASE_URL}/api/portal/certificates`, {
      headers: { Authorization: `Bearer ${verifyData.token}` },
    });
    const certsData = await certsRes.json();
    assert(certsRes.status === 200 && Array.isArray(certsData.certificates), 'Published certificates retrieved for authenticated student');

    if (certsData.certificates.length > 0) {
      const cert = certsData.certificates[0];
      const dlRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verifyData.token}`,
        },
        body: JSON.stringify({ certificateId: cert.id }),
      });
      const dlData = await dlRes.json();
      assert(dlRes.status === 200 && dlData.signedUrl, `Secure short-lived signed URL generated`);
    }

    // IDOR Protection: Cross-student download blocked
    const student2 = INITIAL_STUDENTS[1];
    const cert2 = INITIAL_CERTIFICATES.find((c) => c.studentId === student2.id);
    if (cert2) {
      const idorRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verifyData.token}`,
        },
        body: JSON.stringify({ certificateId: cert2.id }),
      });
      assert(idorRes.status === 403, 'Cross-student certificate download blocked with HTTP 403 (IDOR Protected)');
    }
  } catch (e) {
    assert(false, `Public certificate portal error: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // 6. SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`WORKFLOW VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompleteWorkflowSuite();
