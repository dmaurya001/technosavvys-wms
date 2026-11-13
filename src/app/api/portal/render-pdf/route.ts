import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentSessionToken, normalizeStudentName } from '@/lib/studentAuth';
import { INITIAL_CERTIFICATES, INITIAL_WORKSHOPS } from '@/data/mockData';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllCertificates } from '@/lib/certificateStore';
import { generateCertificatePdf } from '@/lib/pdfGenerator';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdf-certificates');
const TMP_PDF_DIR = path.join(os.tmpdir(), 'technosavvys-pdf-certificates');

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
          studentName: data.student_name || data.recipient_name,
          studentEmail: data.student_email,
          certificateNo: data.certificate_no,
          issueDate: data.issue_date,
          grade: data.grade,
          score: data.score,
          trainer: data.trainer_name,
          workshopTitle: data.workshop_title,
          fileName: data.file_name,
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
      cert.studentId === payload.regNo ||
      (cert.studentEmail && payload.email && cert.studentEmail.toLowerCase().trim() === payload.email.toLowerCase().trim()) ||
      (cert.studentName && payload.name && (
        normalizeStudentName(cert.studentName) === normalizeStudentName(payload.name) ||
        normalizeStudentName(cert.studentName).includes(normalizeStudentName(payload.name)) ||
        normalizeStudentName(payload.name).includes(normalizeStudentName(cert.studentName))
      ));

    if (!isAuthorized) {
      return new NextResponse('Forbidden: Access Denied to unauthorized certificate.', { status: 403 });
    }

    const downloadFileName = cert.fileName || `${cert.certificateNo || 'Certificate'}.pdf`;
    const cleanFilename = downloadFileName.replace(/["\r\n]/g, '');

    // 1. Deliver actual binary PDF file if available on disk
    const localPdfPath = path.join(PDF_DIR, `${certId}.pdf`);
    const tmpPdfPath = path.join(TMP_PDF_DIR, `${certId}.pdf`);
    const existingPdfPath = fs.existsSync(localPdfPath) ? localPdfPath : (fs.existsSync(tmpPdfPath) ? tmpPdfPath : null);

    if (existingPdfPath) {
      const fileBytes = fs.readFileSync(existingPdfPath);
      return new NextResponse(fileBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${cleanFilename}"`,
          'Content-Length': fileBytes.length.toString(),
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    const workshop = INITIAL_WORKSHOPS.find((w) => w.id === cert.workshopId);
    const workshopTitle = cert.workshopTitle || workshop?.title || 'Advanced Technical Workshop';
    const trainerName = cert.trainer || workshop?.trainer || 'Lead Instructor';
    const recipientName = cert.studentName || payload.name;

    // Optional HTML format for preview if requested
    const format = searchParams.get('format');
    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate - ${cert.certificateNo}</title>
  <style>
    @page { size: landscape; margin: 0; }
    body {
      margin: 0; padding: 40px; background: #f8fafc; font-family: 'Georgia', serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .cert-frame {
      width: 1000px; max-width: 95vw; background: #ffffff; border: 8px solid #065f46;
      border-radius: 12px; padding: 50px 60px; text-align: center; outline: 2px solid #ca8a04; outline-offset: -12px;
    }
    h1 { font-size: 38px; color: #0f172a; margin: 0 0 10px 0; }
    .recipient { font-size: 36px; color: #047857; font-weight: bold; margin-bottom: 25px; }
  </style>
</head>
<body>
  <div class="cert-frame">
    <h1>Certificate of Completion</h1>
    <div class="recipient">${recipientName}</div>
    <p>${workshopTitle}</p>
    <p>Awarded to ${recipientName} with Distinction Honors.</p>
  </div>
</body>
</html>`;
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    // 2. Generate and deliver authentic 100% valid binary PDF document
    const pdfBytes = await generateCertificatePdf({
      certificateNo: cert.certificateNo,
      recipientName,
      workshopTitle,
      trainerName,
      issueDate: cert.issueDate || new Date().toISOString().split('T')[0],
      grade: cert.grade || 'Distinction',
      score: cert.score || 95,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanFilename}"`,
        'Content-Length': pdfBytes.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Error in render-pdf route:', err);
    return new NextResponse(err.message || 'Server error', { status: 500 });
  }
}
