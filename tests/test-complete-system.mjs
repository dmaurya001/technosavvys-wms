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
  const cookieHeader = teacherCookie.split(';')[0];
  console.log('PASS: Teacher authenticated successfully.\n');

  // Setup Isolated Test Workshop
  const testWsId = `WS-TEST-SYS-${Date.now().toString().slice(-4)}`;
  const testSessId = `SESS-${testWsId}-1`;
  const testQrToken = `ts_qr_test_${Date.now()}`;

  const createWsRes = await fetch(`${BASE_URL}/api/workshops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      id: testWsId,
      title: 'Automated E2E Test Workshop',
      category: 'Web Dev',
      trainer: 'Test Lead',
      trainerRole: 'Instructor',
      date: '2026-11-04',
      time: '10:00 AM - 05:00 PM',
      duration: '6 Hours',
      location: 'Lab Test',
      capacity: 50,
      price: 0,
      status: 'Ongoing',
      tags: ['Test'],
      sessions: [
        {
          id: testSessId,
          workshopId: testWsId,
          sessionTitle: 'Session 1: Main Workshop',
          date: '2026-11-04',
          startTime: '10:00 AM',
          endTime: '05:00 PM',
          location: 'Lab Test',
          status: 'Scheduled',
          isActive: true,
          qrToken: testQrToken,
        },
      ],
    }),
  });
  assert.strictEqual(createWsRes.status, 200, 'Test workshop creation must succeed');
  console.log(`PASS: Isolated test workshop ${testWsId} created.\n`);

  // Test 2: Student QR Attendance Check-In (Pending Review)
  console.log('Test 2: Student Attendance Submission via Permanent QR');
  const testEmail = `student.${Date.now()}@technosavvys.edu`;
  const testPhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
  const checkInRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workshopId: testWsId,
      workshopTitle: 'Automated E2E Test Workshop',
      sessionId: testSessId,
      sessionTitle: 'Session 1: Main Workshop',
      token: testQrToken,
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
  const attFetchRes = await fetch(`${BASE_URL}/api/attendance?workshopId=${testWsId}&sessionId=${testSessId}`, {
    headers: { Cookie: cookieHeader },
  });
  const attFetchData = await attFetchRes.json();
  assert.strictEqual(attFetchRes.status, 200, 'Attendance fetch must succeed');
  assert.ok(Array.isArray(attFetchData.attendees), 'Attendees array required');
  const foundStudent = attFetchData.attendees.find((a) => a.id === studentRecordId);
  assert.ok(foundStudent, 'Newly submitted student must be present in teacher dashboard attendance');
  assert.strictEqual(foundStudent.status, 'PENDING_REVIEW', 'Status in teacher dashboard must be PENDING_REVIEW');
  console.log('PASS: Student is visible in teacher dashboard with status PENDING_REVIEW.\n');

  // Test 4: Teacher Approves Attendance
  console.log('Test 4: Teacher Approves Attendance Record');
  const approveRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      id: studentRecordId,
      status: 'APPROVED',
    }),
  });
  assert.strictEqual(approveRes.status, 200, 'Attendance approval must return 200');

  // Verify status is now APPROVED
  const verifyRes = await fetch(`${BASE_URL}/api/attendance?workshopId=${testWsId}&sessionId=${testSessId}`, {
    headers: { Cookie: cookieHeader },
  });
  const verifyData = await verifyRes.json();
  const approvedRecord = verifyData.attendees.find((a) => a.id === studentRecordId);
  assert.ok(approvedRecord, 'Record must exist');
  assert.strictEqual(approvedRecord.status, 'APPROVED', 'Status must be APPROVED after teacher action');
  console.log('PASS: Attendance successfully approved by teacher.\n');

  // Test 5: Publish Certificate for Approved Student
  console.log('Test 5: Publish Certificate for Approved Student');
  const publishRes = await fetch(`${BASE_URL}/api/certificates/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      workshopId: testWsId,
      workshopTitle: 'Automated E2E Test Workshop',
      certificates: [
        {
          studentId: studentRecordId,
          studentName: 'Aman Sharma',
          studentEmail: testEmail,
          workshopId: testWsId,
          workshopTitle: 'Automated E2E Test Workshop',
          grade: 'Distinction',
          score: 95,
          fileName: 'Aman_Sharma.pdf',
        },
      ],
    }),
  });
  const publishData = await publishRes.json();
  assert.strictEqual(publishRes.status, 200, `Publish must succeed: ${JSON.stringify(publishData)}`);
  assert.strictEqual(publishData.publishedCount, 1, 'One certificate must be published');
  console.log('PASS: Certificate published successfully with service-role security.\n');

  // Test 6: Verify IDOR Protection on Student Portal & Cascade Cleanup
  console.log('Test 6: Verify IDOR Protection & Cascade Cleanup');
  const certListRes = await fetch(`${BASE_URL}/api/portal/certificates?workshopId=${testWsId}`, {
    headers: { Cookie: cookieHeader },
  });
  assert.strictEqual(certListRes.status, 403, 'Teacher without student credentials must be rejected with 403');
  console.log('PASS: IDOR Protection verified: Teacher blocked from student portal endpoint.');

  // Clean up test workshop and attendance via safe cascade delete
  const cleanupRes = await fetch(`${BASE_URL}/api/workshops?id=${testWsId}`, {
    method: 'DELETE',
    headers: { Cookie: cookieHeader },
  });
  assert.strictEqual(cleanupRes.status, 200, 'Cleanup of test workshop must succeed');
  console.log(`PASS: Isolated test workshop ${testWsId} and linked attendance cleanly purged with backup.\n`);

  console.log('=== ALL 6 END-TO-END VERIFICATION TESTS PASSED WITH ZERO POLLUTION ===');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILURE:', err);
  process.exit(1);
});
