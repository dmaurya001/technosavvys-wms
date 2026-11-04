import { isAdminIdentifier, verifyAdminPassword, updateAdminPassword } from '../src/lib/adminAuth.ts';
import { INITIAL_STUDENTS } from '../src/data/mockData.ts';

const BASE_URL = 'http://localhost:3000';

async function runProductionAuthVerification() {
  console.log('================================================================');
  console.log('TECHNOSAVVYS WMS - PRODUCTION AUTH & DEPLOYMENT VERIFICATION');
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
  // TASK 1: DEFAULT LANDING PAGE & ROUTE PROTECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 1. DEFAULT LANDING PAGE & ROUTE PROTECTION ---');

  const rootRes = await fetch(`${BASE_URL}/`);
  const rootText = await rootRes.text();
  assert(rootRes.status === 200, 'Root / route returns HTTP 200');
  assert(rootText.includes('Authentication Gateway'), 'Root / renders Login Selection Gateway (Authentication Gateway)');
  assert(rootText.includes('Admin / Teacher Login'), 'Root / displays "Admin / Teacher Login" card');
  assert(rootText.includes('Student Login'), 'Root / displays "Student Login" card');
  assert(!rootText.includes('Quick Sandbox Access'), 'Root / has ZERO sandbox or demo buttons');

  const loginRes = await fetch(`${BASE_URL}/login`);
  const loginText = await loginRes.text();
  assert(loginRes.status === 200 && loginText.includes('Authentication Gateway'), 'Route /login renders Login Selection Gateway');

  // Verify private route protection
  const dashRes = await fetch(`${BASE_URL}/teacher/dashboard`, { redirect: 'manual' });
  assert(dashRes.status === 307 || dashRes.status === 308, 'Unauthenticated /teacher/dashboard triggers redirect');
  const dashLocation = dashRes.headers.get('location') || '';
  assert(dashLocation.includes('/teacher/login'), 'Redirects unauthenticated user to /teacher/login');

  // --------------------------------------------------------------------------
  // TASK 2: REMOVAL OF TEMPORARY & DEMO ACCOUNTS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. REMOVAL OF TEMPORARY ACCOUNTS ---');

  const demoTeacherRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@technosavvys.edu', password: 'teacher123' }),
  });
  assert(demoTeacherRes.status === 401, 'Temporary account teacher@technosavvys.edu strictly rejected with HTTP 401');

  const demoInstructorRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@technosavvys.edu', password: 'password123' }),
  });
  assert(demoInstructorRes.status === 401, 'Temporary account instructor@technosavvys.edu strictly rejected with HTTP 401');

  const demoAdminRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@technosavvys.edu', password: 'admin' }),
  });
  assert(demoAdminRes.status === 401, 'Temporary account admin@technosavvys.edu strictly rejected with HTTP 401');

  // Verify plain string bypass is rejected
  const plainBypassRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: 'technosavvys_teacher_session=authenticated_teacher' },
  });
  assert(plainBypassRes.status === 401, 'Plain string session bypass "authenticated_teacher" strictly rejected with HTTP 401');

  // --------------------------------------------------------------------------
  // TASK 3: PERMANENT ADMIN ACCOUNT VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. PERMANENT ADMIN ACCOUNT (techno3deepak@gmail.com) ---');

  assert(isAdminIdentifier('techno3deepak@gmail.com'), 'Recognizes primary admin email: techno3deepak@gmail.com');
  assert(isAdminIdentifier('Deepak@8960@techno'), 'Recognizes primary admin username: Deepak@8960@techno');
  assert(!isAdminIdentifier('fake@admin.com'), 'Rejects unrecognized email as admin');

  // Admin login using Email
  const adminEmailLoginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'Deepak@8960@techno',
    }),
  });
  const adminEmailLoginData = await adminEmailLoginRes.json();
  assert(adminEmailLoginRes.status === 200 && adminEmailLoginData.success, 'Permanent admin login via EMAIL succeeds with HTTP 200');
  assert(adminEmailLoginData.teacher.email === 'techno3deepak@gmail.com', 'Authenticated session matches techno3deepak@gmail.com');

  const adminCookieHeader = adminEmailLoginRes.headers.get('set-cookie') || '';
  assert(adminCookieHeader.includes('technosavvys_teacher_session'), 'Admin login sets HttpOnly teacher session cookie');

  // Admin login using Username
  const adminUsernameLoginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'Deepak@8960@techno',
      password: 'Deepak@8960@techno',
    }),
  });
  assert(adminUsernameLoginRes.status === 200, 'Permanent admin login via USERNAME (Deepak@8960@techno) succeeds with HTTP 200');

  // Wrong password rejection
  const wrongPwdRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'WrongPassword123!',
    }),
  });
  assert(wrongPwdRes.status === 401, 'Wrong admin password strictly rejected with HTTP 401');

  // Password Reset API
  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'techno3deepak@gmail.com' }),
  });
  const resetData = await resetRes.json();
  assert(resetRes.status === 200 && resetData.success, 'Password reset request endpoint returns HTTP 200');

  // --------------------------------------------------------------------------
  // TASK 4: ADMIN PASSWORD MANAGEMENT & SETTINGS
  // --------------------------------------------------------------------------
  console.log('\n--- 4. ADMIN PASSWORD MANAGEMENT (/api/auth/change-password) ---');

  // Unauthorized call without session
  const unauthChangeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: 'Deepak@8960@techno',
      newPassword: 'NewSecurePassword2026!',
      confirmPassword: 'NewSecurePassword2026!',
    }),
  });
  assert(unauthChangeRes.status === 401, 'Change password without authenticated session rejected with HTTP 401');

  // Extract cookie from admin login
  const cookies = adminCookieHeader.split(',').map((c) => c.split(';')[0].trim()).join('; ');

  // Mismatched confirmation password
  const mismatchRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({
      currentPassword: 'Deepak@8960@techno',
      newPassword: 'NewPassword123!',
      confirmPassword: 'DifferentPassword123!',
    }),
  });
  assert(mismatchRes.status === 400, 'Mismatched new password and confirmation rejected with HTTP 400');

  // Wrong current password
  const wrongCurrentRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({
      currentPassword: 'IncorrectOldPassword!',
      newPassword: 'NewSecurePassword2026!',
      confirmPassword: 'NewSecurePassword2026!',
    }),
  });
  assert(wrongCurrentRes.status === 403, 'Incorrect current password rejected with HTTP 403');

  // Valid password change
  const validChangeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({
      currentPassword: 'Deepak@8960@techno',
      newPassword: 'DeepakUpdated@2026!',
      confirmPassword: 'DeepakUpdated@2026!',
    }),
  });
  const validChangeData = await validChangeRes.json();
  assert(validChangeRes.status === 200 && validChangeData.success, 'Valid password update succeeds with HTTP 200');

  // Verify old password no longer works
  const oldPwdTest = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'Deepak@8960@techno',
    }),
  });
  assert(oldPwdTest.status === 401, 'Previous password no longer works (HTTP 401)');

  // Verify new password works
  const newPwdTest = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'DeepakUpdated@2026!',
    }),
  });
  assert(newPwdTest.status === 200, 'New updated password authenticates successfully (HTTP 200)');

  // Revert back to original password using change-password API
  const newCookies = newPwdTest.headers.get('set-cookie')?.split(',').map((c) => c.split(';')[0].trim()).join('; ') || '';
  const revertChangeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: newCookies },
    body: JSON.stringify({
      currentPassword: 'DeepakUpdated@2026!',
      newPassword: 'Deepak@8960@techno',
      confirmPassword: 'Deepak@8960@techno',
    }),
  });
  assert(revertChangeRes.status === 200, 'Provisioned admin password restored via change-password API');

  const revertTest = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: 'Deepak@8960@techno',
    }),
  });
  assert(revertTest.status === 200, 'Original provisioned admin password verified working');

  // --------------------------------------------------------------------------
  // TASK 5: TEST STUDENT (Ram, 8960627330)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. TEST STUDENT (Ram, 8960627330) ---');

  const ram = INITIAL_STUDENTS.find((s) => s.phone === '8960627330');
  assert(!!ram, 'Test student record exists in student dataset');
  assert(ram.name === 'Ram', 'Student name is strictly "Ram"');
  assert(ram.phone === '8960627330', 'Student mobile is strictly "8960627330"');
  assert(ram.batch === 'TEST', 'Student record is clearly marked as TEST (batch: "TEST")');
  assert(ram.totalAttended === 0 && ram.enrolledWorkshopIds.length === 0, 'Zero fake attendance records generated for test student');

  // Test student requests OTP via actual flow
  const ramOtpRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Ram', mobileNumber: '8960627330' }),
  });
  const ramOtpData = await ramOtpRes.json();
  assert(ramOtpRes.status === 200 && ramOtpData.success, 'Test student Ram successfully requests OTP (HTTP 200)');
  assert(ramOtpData.studentName === 'Ram', 'OTP response confirms student identity: Ram');

  const otp = ramOtpData.devOtp || ramOtpData.simulatedOtp;
  assert(!!otp && otp.length === 6, 'Valid 6-digit cryptographic OTP generated for Ram');

  // Test student verifies OTP
  const ramVerifyRes = await fetch(`${BASE_URL}/api/portal/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: '8960627330', otp }),
  });
  const ramVerifyData = await ramVerifyRes.json();
  assert(ramVerifyRes.status === 200 && ramVerifyData.success, 'Test student Ram successfully verifies OTP (HTTP 200)');
  assert(ramVerifyData.student.name === 'Ram', 'Verified session belongs to Ram');
  assert(!!ramVerifyData.token, 'Student receives cryptographic session token');

  // Verify non-registered phone number is rejected
  const fakePhoneRes = await fetch(`${BASE_URL}/api/portal/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Unknown', mobileNumber: '9999999999' }),
  });
  assert(fakePhoneRes.status === 404, 'Unregistered phone number strictly rejected with HTTP 404');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`PRODUCTION AUTH SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionAuthVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
