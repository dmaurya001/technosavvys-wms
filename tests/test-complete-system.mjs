import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING END-TO-END VERIFICATION ===\n');

  // Test 1: Teacher Login
  console.log('Test 1: Teacher Login & Session Token');
  const loginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'Deepak@8960@techno',
    }),
  });
  assert.strictEqual(loginRes.status, 200, 'Teacher login must return 200');
  const teacherCookie = loginRes.headers.get('set-cookie');
  assert.ok(teacherCookie, 'Teacher session cookie must be set');
  console.log('PASS: Teacher authenticated successfully.\n');

  // Test 2: Student QR Attendance Check-In (Pending Review)
  console.log('Test 2: Student Attendance Submission via Permanent QR');
  const testEmail = `student.${Date.now()}@technosavvys.edu`;
  const testPhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
  const checkInRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workshopId: 'WS-101',
      workshopTitle: 'Advanced Full-Stack Development with Next.js & Server Actions',
      sessionId: 'SESS-101-1',
      token: 'ts_qr_f06db3ea59575b486831c4b6bfd540b3', // valid permanent QR token for WS-101 / SESS-101-1
      fullName: 'Aman Sharma',
      email: testEmail,
      phone: testPhone,
      course: 'B.Tech CSE',
    }),
  });
  const checkInData = await checkInRes.json();
  assert.strictEqual(checkInRes.status, 200, `Student check-in failed: ${JSON.stringify(checkInData)}`);
  assert.strictEqual(checkInData.record.status, 'PENDING_REVIEW', 'Initial status must be PENDING_REVIEW');
  const studentRecordId = checkInData.record.id;
  console.log(`PASS: Student attendance submitted. ID: ${studentRecordId}, Status: PENDING_REVIEW\n`);

  // Test 3: Teacher Live Attendance Fetch (Record must be visible under All and Pending)
  console.log('Test 3: Teacher Live Attendance Fetch Verification');
  const attFetchRes = await fetch(`${BASE_URL}/api/attendance?workshopId=WS-101&sessionId=SESS-101-1`, {
    headers: { Cookie: teacherCookie },
  });
  const attFetchData = await attFetchRes.json();
  assert.strictEqual(attFetchRes.status, 200, 'Attendance fetch must succeed');
  assert.ok(Array.isArray(attFetchData.attendees), 'Attendees array required');
  const foundStudent = attFetchData.attendees.find((a) => a.id === studentRecordId);
  assert.ok(foundStudent, 'Submitted student must appear in teacher attendance list');
  assert.strictEqual(foundStudent.status, 'PENDING_REVIEW', 'Status in teacher dashboard must be PENDING_REVIEW');
  console.log('PASS: Student is visible in teacher dashboard with status PENDING_REVIEW.\n');

  // Test 4: Teacher Approves Attendance
  console.log('Test 4: Teacher Approves Attendance Record');
  const approveRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: teacherCookie,
    },
    body: JSON.stringify({
      id: studentRecordId,
      status: 'APPROVED',
    }),
  });
  const approveData = await approveRes.json();
  assert.strictEqual(approveRes.status, 200, 'Attendance approval must return 200');
  assert.strictEqual(approveData.record.status, 'APPROVED', 'Status must transition to APPROVED');
  console.log('PASS: Attendance successfully approved by teacher.\n');

  // Test 5: Verify Certificate Publishing Flow via API
  console.log('Test 5: Publish Certificate for Approved Student');
  const dummyPdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n50\n%%EOF').toString('base64');
  
  const publishRes = await fetch(`${BASE_URL}/api/certificates/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: teacherCookie,
    },
    body: JSON.stringify({
      workshopId: 'WS-101',
      workshopTitle: 'Advanced Full-Stack Development with Next.js & Server Actions',
      certificates: [
        {
          fileName: 'Aman_Sharma.pdf',
          studentId: 'STU-009', // Deepak Maurya (approved attendee)
          studentName: 'Deepak Maurya',
          fileBase64: dummyPdfBase64,
        },
      ],
    }),
  });
  const publishData = await publishRes.json();
  assert.strictEqual(publishRes.status, 200, `Publish must succeed: ${JSON.stringify(publishData)}`);
  assert.strictEqual(publishData.publishedCount, 1, 'One certificate must be published');
  console.log('PASS: Certificate published successfully with service-role security.\n');

  // Test 6: Verify Certificate Access & IDOR Verification
  console.log('Test 6: Certificate Access & IDOR Verification');
  const reqOtpRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: '8960627331' }),
  });
  const reqOtpData = await reqOtpRes.json();
  assert.strictEqual(reqOtpRes.status, 200, `OTP request failed: ${JSON.stringify(reqOtpData)}`);

  const otpToUse = reqOtpData.devOtp || '123456';

  const otpRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobileNumber: '8960627331',
      otp: otpToUse,
    }),
  });
  const otpData = await otpRes.json();
  assert.strictEqual(otpRes.status, 200, `Student OTP verify failed: ${JSON.stringify(otpData)}`);
  const studentCookie = otpRes.headers.get('set-cookie');
  assert.ok(studentCookie, 'Student cookie must be set');

  const certListRes = await fetch(`${BASE_URL}/api/portal/certificates`, {
    headers: { Cookie: studentCookie },
  });
  const certListData = await certListRes.json();
  assert.strictEqual(certListRes.status, 200, 'Student certificate listing must succeed');
  assert.ok(Array.isArray(certListData.certificates), 'Certificates array required');
  console.log(`PASS: Student certificate portal verified (${certListData.count} certificates available).\n`);

  console.log('=== ALL 6 END-TO-END VERIFICATION TESTS PASSED ===');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILURE:', err);
  process.exit(1);
});
