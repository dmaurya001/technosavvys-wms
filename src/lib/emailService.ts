import nodemailer from 'nodemailer';

interface SendOtpEmailParams {
  toEmail: string;
  studentName: string;
  otpCode: string;
}

interface SendEmailParams {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  debugHint?: string;
}

async function sendEmail({
  toEmail,
  subject,
  text,
  html,
  debugHint,
}: SendEmailParams): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  const cleanEmail = toEmail.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, delivered: false, error: 'Missing recipient email.' };
  }

  const host = process.env.SMTP_HOST || (process.env.GMAIL_APP_PASSWORD ? 'smtp.gmail.com' : '');
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '';
  const from = process.env.SMTP_FROM || `"Technosavvys Academic Systems" <${user || 'no-reply@technosavvys.edu'}>`;

  if (!host || !user || !pass) {
    console.log(`[EmailService] SMTP not configured. ${debugHint || subject} -> ${cleanEmail}`);
    return {
      success: true,
      delivered: false,
      error: 'SMTP credentials not configured on server. Simulated sandbox dispatch.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });

    await transporter.sendMail({
      from,
      to: cleanEmail,
      subject,
      text,
      html,
    });

    console.log(`[EmailService] Email sent to ${cleanEmail} (${subject})`);
    return { success: true, delivered: true };
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${cleanEmail}:`, err);
    return {
      success: true,
      delivered: false,
      error: err.message || 'SMTP delivery failed.',
    };
  }
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendOtpEmail({
  toEmail,
  studentName,
  otpCode,
}: SendOtpEmailParams): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  const safeName = escapeHtml(studentName);
  const safeOtp = escapeHtml(otpCode);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Technosavvys Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #060f08; color: #ecfdf5; margin: 0; padding: 24px; }
        .card { max-width: 500px; margin: 0 auto; background-color: #0a1f14; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .logo { font-size: 14px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0; }
        .greeting { font-size: 14px; color: #a7f3d0; margin-bottom: 20px; line-height: 1.5; }
        .otp-box { background: rgba(16, 185, 129, 0.15); border: 2px dashed #10b981; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10b981; margin: 0; }
        .otp-hint { font-size: 11px; color: #6ee7b7; margin-top: 8px; }
        .footer { font-size: 11px; color: rgba(236, 253, 245, 0.5); border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Technosavvys Official Credential Portal</div>
        <h1 class="title">Verification Code</h1>
        <p class="greeting">Hello <strong>${safeName}</strong>,<br>You requested an authentication code to verify your identity and access your workshop certificates.</p>
        <div class="otp-box">
          <div class="otp-code">${safeOtp}</div>
          <div class="otp-hint">Valid for 5 minutes • Do not share with anyone</div>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">If you did not make this request, you can safely ignore this email.</p>
        <div class="footer">
          Technosavvys Academic Systems • Cryptographic Credential Distribution
        </div>
      </div>
    </body>
    </html>
    `;

  return sendEmail({
    toEmail,
    subject: `Your Technosavvys Verification Code: ${otpCode}`,
    text: `Hello ${studentName},\n\nYour Technosavvys verification code is: ${otpCode}\n\nThis code is valid for 5 minutes. Do not share it with anyone.`,
    html: htmlContent,
    debugHint: `OTP for ${studentName}: [${otpCode}]`,
  });
}

export async function sendAttendanceApprovalEmail({
  toEmail,
  studentName,
  workshopTitle,
  portalUrl,
}: {
  toEmail: string;
  studentName: string;
  workshopTitle: string;
  portalUrl: string;
}) {
  const safeName = escapeHtml(studentName);
  const safeWorkshop = escapeHtml(workshopTitle);
  const safeUrl = escapeHtml(portalUrl);

  return sendEmail({
    toEmail,
    subject: `Attendance Approved: ${workshopTitle}`,
    text: `Hello ${studentName},\n\nYour attendance for "${workshopTitle}" has been approved. You are now eligible for your workshop certificate.\n\nStudent Portal: ${portalUrl}`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#060f08;color:#ecfdf5;padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#0a1f14;border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:28px;">
          <div style="font-size:12px;font-weight:700;color:#34d399;letter-spacing:1.2px;text-transform:uppercase;">Technosavvys WMS</div>
          <h2 style="color:#ffffff;margin:12px 0;">Attendance Approved</h2>
          <p style="color:#a7f3d0;font-size:14px;line-height:1.6;">Hello <strong>${safeName}</strong>,<br>Your attendance for <strong>${safeWorkshop}</strong> has been approved by the instructor. You are now eligible for certificate issuance.</p>
          <a href="${safeUrl}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#10b981;color:#042f1e;font-weight:700;text-decoration:none;border-radius:10px;">Open Student Portal</a>
        </div>
      </div>
    `,
    debugHint: `Attendance approved for ${studentName}`,
  });
}

export async function sendCertificateIssuedEmail({
  toEmail,
  studentName,
  workshopTitle,
  certificateNo,
  verifyUrl,
  portalUrl,
}: {
  toEmail: string;
  studentName: string;
  workshopTitle: string;
  certificateNo: string;
  verifyUrl: string;
  portalUrl: string;
}) {
  const safeName = escapeHtml(studentName);
  const safeWorkshop = escapeHtml(workshopTitle);
  const safeCertNo = escapeHtml(certificateNo);
  const safeVerifyUrl = escapeHtml(verifyUrl);
  const safePortalUrl = escapeHtml(portalUrl);

  return sendEmail({
    toEmail,
    subject: `Certificate Issued (${certificateNo}) - ${workshopTitle}`,
    text: `Hello ${studentName},\n\nYour certificate (${certificateNo}) for "${workshopTitle}" has been published.\n\nVerify publicly: ${verifyUrl}\nDownload from Student Portal: ${portalUrl}`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#060f08;color:#ecfdf5;padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#0a1f14;border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:28px;">
          <div style="font-size:12px;font-weight:700;color:#34d399;letter-spacing:1.2px;text-transform:uppercase;">Technosavvys Credential Portal</div>
          <h2 style="color:#ffffff;margin:12px 0;">Certificate Issued</h2>
          <p style="color:#a7f3d0;font-size:14px;line-height:1.6;">Congratulations <strong>${safeName}</strong>,<br>Your official certificate for <strong>${safeWorkshop}</strong> is now live.</p>
          <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:10px;padding:12px 16px;margin:16px 0;font-family:monospace;color:#6ee7b7;">Certificate No: ${safeCertNo}</div>
          <div style="margin-top:18px;">
            <a href="${safePortalUrl}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#042f1e;font-weight:700;text-decoration:none;border-radius:10px;margin-right:10px;">Download PDF</a>
            <a href="${safeVerifyUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #10b981;color:#34d399;font-weight:600;text-decoration:none;border-radius:10px;">Verify Link</a>
          </div>
        </div>
      </div>
    `,
    debugHint: `Certificate ${certificateNo} issued to ${studentName}`,
  });
}

