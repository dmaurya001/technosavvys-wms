import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('[TEST] 1. Teacher Login...');
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/teacher-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'techno3deepak@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'Deepak@8960@techno',
    }),
  });

  const teacherData = await teacherLoginRes.json();
  console.log('[TEST] Teacher login status:', teacherLoginRes.status, teacherData.success);
  assert.strictEqual(teacherLoginRes.status, 200, 'Teacher login should succeed');

  const cookies = teacherLoginRes.headers.get('set-cookie') || '';
  const teacherCookie = cookies.split(';')[0];
  console.log('[TEST] Got teacher cookie');

  console.log('[TEST] 2. Publish certificate for approved student Deepak...');
  const publishRes = await fetch(`${BASE_URL}/api/certificates/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: teacherCookie,
    },
    body: JSON.stringify({
      workshopId: 'WS-101',
      workshopTitle: 'Advanced Full-Stack Development',
      certificates: [
        {
          fileName: 'Deepak.pdf',
          studentId: 'ATT-682275',
          studentName: 'Deepak',
          studentEmail: 'deepakmaurya.aict@gmail.com',
          studentPhone: '8960627330',
          attendanceApproved: true,
          fileBase64: Buffer.from('%PDF-1.4 test certificate').toString('base64'),
        },
      ],
    }),
  });

  const publishData = await publishRes.json();
  console.log('[TEST] Publish status:', publishRes.status, publishData);
  assert.strictEqual(publishRes.status, 200, 'Publish should succeed');
  assert.strictEqual(publishData.success, true, 'Publish response must be success');
  assert.ok(publishData.publishedCount >= 1, 'Published count must be >= 1');
  const publishedCert = publishData.certificates[0];
  console.log('[TEST] Published certificate ID:', publishedCert.id, publishedCert.certificateNo);

  console.log('[TEST] 3. Student direct-login via Full Name & Email...');
  const directLoginRes = await fetch(`${BASE_URL}/api/portal/direct-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Deepak',
      email: 'deepakmaurya.aict@gmail.com',
    }),
  });

  const directLoginData = await directLoginRes.json();
  console.log('[TEST] Direct login status:', directLoginRes.status, 'Certs count:', directLoginData.certificates?.length);
  assert.strictEqual(directLoginRes.status, 200, 'Direct login must succeed');
  assert.ok(directLoginData.token, 'Must return session token');
  assert.ok(directLoginData.certificates && directLoginData.certificates.length >= 1, 'Must find published certificate');
  console.log('[TEST] Found certificate for Deepak:', directLoginData.certificates[0].certificateNo);

  console.log('[TEST] 4. Request download URL for the certificate...');
  const downloadRes = await fetch(`${BASE_URL}/api/portal/download-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directLoginData.token}`,
    },
    body: JSON.stringify({
      certificateId: publishedCert.id,
    }),
  });

  const downloadData = await downloadRes.json();
  console.log('[TEST] Download URL status:', downloadRes.status, downloadData);
  assert.strictEqual(downloadRes.status, 200, 'Download URL generation must succeed');
  assert.ok(downloadData.signedUrl, 'Must return signed download URL');

  console.log('[TEST] ALL END-TO-END TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
