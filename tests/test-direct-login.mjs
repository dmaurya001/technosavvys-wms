import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('=== TEST: DIRECT NAME & EMAIL LOGIN (NO OTP) ===\n');

  // Test 1: Valid direct student login
  console.log('1. Direct Login with Aditya Verma & aditya.verma@technosavvys.edu');
  const res = await fetch(`${BASE_URL}/api/portal/direct-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Aditya Verma',
      email: 'aditya.verma@technosavvys.edu',
    }),
  });

  const data = await res.json();
  console.log('Direct Login Response:', data);
  assert.strictEqual(res.status, 200, 'Direct login must return status 200');
  assert.strictEqual(data.success, true, 'Direct login must succeed');
  assert.ok(data.token, 'Session token must be returned');
  assert.strictEqual(data.student.name, 'Aditya Verma', 'Student name must match');
  assert.ok(Array.isArray(data.certificates), 'Certificates list must be returned');
  assert.strictEqual(data.certificates.length, 1, 'Should find published certificate');
  console.log('PASS: Student directly authenticated and certificates returned without OTP.\n');

  // Test 2: Reject unregistered student
  console.log('2. Reject unregistered email');
  const badRes = await fetch(`${BASE_URL}/api/portal/direct-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Fake Student',
      email: 'fake.student@nonexistent.edu',
    }),
  });
  assert.strictEqual(badRes.status, 404, 'Non-existent student must return 404');
  console.log('PASS: Unregistered student rejected.\n');

  console.log('=== ALL DIRECT LOGIN TESTS PASSED! ===');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});

