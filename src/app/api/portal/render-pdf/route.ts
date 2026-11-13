import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentSessionToken, normalizeStudentName } from '@/lib/studentAuth';
import { INITIAL_CERTIFICATES, INITIAL_WORKSHOPS } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllCertificates } from '@/lib/certificateStore';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const certId = searchParams.get('id');
    const token = searchParams.get('auth');
    const expires = Number(searchParams.get('expires') || 0);

    if (!token || !certId) {
      return new NextResponse('Unauthorized: Missing authentication credentials.', { status: 401 });
    }

    if (Date.now() > expires) {
      return new NextResponse('Forbidden: Temporary signed download link has expired. Please request a new link.', { status: 403 });
    }

    let payload;
    try {
      payload = verifyStudentSessionToken(token);
    } catch (err: any) {
      return new NextResponse('Unauthorized: Invalid or tampered student token.', { status: 401 });
    }

    // Lookup certificate
    let cert: any = null;
    try {
      const supabaseAdmin = createAdminClient();
      const { data } = await supabaseAdmin.from('certificates').select('*').eq('id', certId).single();
      if (data) {
        cert = {
          id: data.id,
          studentId: data.student_id,
          certificateNo: data.certificate_no,
          issueDate: data.issue_date,
          grade: data.grade,
          score: data.score,
          trainer: data.trainer_name,
        };
      }
    } catch {}

    if (!cert) {
      try {
        const stored = await getAllCertificates();
        const found = stored.find((c) => c.id === certId);
        if (found) cert = found;
      } catch {}
    }

    if (!cert) {
      cert = INITIAL_CERTIFICATES.find((c) => c.id === certId);
    }

    if (!cert) {
      return new NextResponse('Certificate not found.', { status: 404 });
    }

    // Strict Authorization Check
    const isAuthorized =
      cert.studentId === payload.studentId ||
      (cert.studentName && payload.name && normalizeStudentName(cert.studentName) === normalizeStudentName(payload.name));

    if (!isAuthorized) {
      return new NextResponse('Forbidden: Access Denied to unauthorized certificate.', { status: 403 });
    }

    const workshop = INITIAL_WORKSHOPS.find((w) => w.id === cert.workshopId);
    const workshopTitle = cert.workshopTitle || workshop?.title || 'Advanced Technical Workshop';
    const trainerName = cert.trainer || workshop?.trainer || 'Lead Instructor';
    const recipientName = cert.studentName || payload.name;

    // Return a self-contained printable SVG/HTML certificate document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate - ${cert.certificateNo}</title>
  <style>
    @page { size: landscape; margin: 0; }
    body {
      margin: 0;
      padding: 40px;
      background: #f8fafc;
      font-family: 'Georgia', serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .cert-frame {
      width: 1000px;
      max-width: 95vw;
      background: #ffffff;
      border: 12px double #1e293b;
      padding: 60px 50px;
      text-align: center;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .badge {
      display: inline-block;
      padding: 6px 18px;
      background: #eef2ff;
      border: 1px solid #6366f1;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 38px;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: #0f172a;
      margin: 0 0 10px 0;
      font-weight: 900;
    }
    .subtitle {
      font-size: 13px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 25px;
    }
    .recipient {
      font-size: 36px;
      font-style: italic;
      color: #312e81;
      border-bottom: 2px solid #cbd5e1;
      display: inline-block;
      padding: 0 40px 10px 40px;
      margin-bottom: 25px;
      font-weight: bold;
    }
    .description {
      font-size: 15px;
      color: #475569;
      line-height: 1.8;
      max-width: 720px;
      margin: 0 auto 40px auto;
    }
    .strong-title {
      font-size: 18px;
      font-weight: bold;
      color: #0f172a;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 50px;
      border-top: 1px solid #e2e8f0;
      padding-top: 25px;
    }
    .sign-box {
      text-align: center;
      width: 220px;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      margin-top: 10px;
      padding-top: 5px;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .serial-box {
      font-family: monospace;
      font-size: 12px;
      color: #4338ca;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div class="badge">Official Verified Credential</div>
    <h1>Certificate of Completion</h1>
    <div class="subtitle">This is proudly presented and certified to</div>
    <div class="recipient">${recipientName}</div>
    <div class="description">
      For exceptional dedication, attendance, and successful completion of the executive technical workshop on:<br>
      <span class="strong-title">${workshopTitle}</span><br>
      Awarded with <strong>${cert.grade}</strong> grade. Validated by Technosavvys Academic Council.
    </div>
    <div class="footer">
      <div class="sign-box">
        <div style="font-size: 16px; font-style: italic; color: #1e293b;">${trainerName}</div>
        <div class="sign-line">Lead Instructor</div>
      </div>
      <div class="sign-box">
        <div class="serial-box">${cert.certificateNo}</div>
        <div class="sign-line">Security Serial Number</div>
      </div>
      <div class="sign-box">
        <div style="font-size: 14px; color: #1e293b;">${cert.issueDate}</div>
        <div class="sign-line">Date of Issuance</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      // Auto-trigger print dialog if intended for printing
      if (window.location.search.includes('print=true')) {
        window.print();
      }
    };
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'Server error', { status: 500 });
  }
}

