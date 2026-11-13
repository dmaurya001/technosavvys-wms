import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('=== TEST: STUDENT PORTAL EMAIL OTP AUTHENTICATION ===\n');

  // Test 1: Request OTP with valid registered email
  console.log('1. Request OTP using Email (Aditya Verma)');
  const reqRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Aditya Verma',
      email: 'aditya.verma@technosavvys.edu',
    }),
  });

  const reqData = await reqRes.json();
  console.log('Request OTP Response:', reqData);
  assert.strictEqual(reqRes.status, 200, 'Request OTP must return status 200');
  assert.strictEqual(reqData.success, true, 'Request OTP must succeed');
  assert.ok(reqData.maskedEmail, 'Masked email must be returned');
  const otpCode = reqData.devOtp || reqData.simulatedOtp;
  assert.ok(otpCode, 'OTP code must be generated');
  console.log('PASS: Email OTP requested successfully.\n');

  // Test 2: Verify OTP with valid email and code
  console.log('2. Verify OTP using Email & Generated Code');
  const verifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aditya.verma@technosavvys.edu',
      otp: otpCode,
    }),
  });

  const verifyData = await verifyRes.json();
  console.log('Verify OTP Response:', verifyData);
  assert.strictEqual(verifyRes.status, 200, 'Verify OTP must return status 200');
  assert.strictEqual(verifyData.success, true, 'Verify OTP must succeed');
  assert.ok(verifyData.token, 'Student authorization token must be returned');
  assert.strictEqual(verifyData.student.name, 'Aditya Verma', 'Student name must match');
  console.log('PASS: Email OTP verified successfully.\n');

  // Test 3: Retrieve Certificates using Student Token
  console.log('3. Fetch student certificates with Bearer token');
  const certRes = await fetch(`${BASE_URL}/api/portal/certificates`, {
    headers: {
      Authorization: `Bearer ${verifyData.token}`,
    },
  });

  const certData = await certRes.json();
  console.log('Certificates Response:', certData);
  assert.strictEqual(certRes.status, 200, 'Certificates listing must return 200');
  assert.strictEqual(certData.success, true, 'Certificates listing must succeed');
  console.log('PASS: Student certificates fetched successfully.\n');

  // Test 4: Reject Invalid OTP
  console.log('4. Reject invalid OTP code');
  const badVerifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aditya.verma@gmail.com',
      otp: '000000',
    }),
  });
  assert.strictEqual(badVerifyRes.status, 400, 'Invalid OTP must return 400');
  console.log('PASS: Invalid OTP rejected.\n');

  // Test 5: Reject Unregistered Email
  console.log('5. Reject unregistered email');
  const badReqRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Unknown Person',
      email: 'unknown.nonexistent@gmail.com',
    }),
  });
  assert.strictEqual(badReqRes.status, 404, 'Unregistered email must return 404');
  console.log('PASS: Unregistered student rejected.\n');

  console.log('=== ALL EMAIL OTP TESTS PASSED! ===');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
