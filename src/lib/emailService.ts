import nodemailer from 'nodemailer';

interface SendOtpEmailParams {
  toEmail: string;
  studentName: string;
  otpCode: string;
}

export async function sendOtpEmail({
  toEmail,
  studentName,
  otpCode,
}: SendOtpEmailParams): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  const cleanEmail = toEmail.trim().toLowerCase();

  // 1. Check for SMTP or Gmail App Password configuration
  const host = process.env.SMTP_HOST || (process.env.GMAIL_APP_PASSWORD ? 'smtp.gmail.com' : '');
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '';
  const from = process.env.SMTP_FROM || `"Technosavvys Academic Systems" <${user || 'no-reply@technosavvys.edu'}>`;

  if (!host || !user || !pass) {
    console.log(`[EmailService] SMTP not configured. OTP for ${studentName} (${cleanEmail}): [${otpCode}]`);
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
        <p class="greeting">Hello <strong>${studentName}</strong>,<br>You requested an authentication code to verify your identity and access your workshop certificates.</p>
        <div class="otp-box">
          <div class="otp-code">${otpCode}</div>
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

    await transporter.sendMail({
      from,
      to: cleanEmail,
      subject: `Your Technosavvys Verification Code: ${otpCode}`,
      text: `Hello ${studentName},\n\nYour Technosavvys verification code is: ${otpCode}\n\nThis code is valid for 5 minutes. Do not share it with anyone.`,
      html: htmlContent,
    });

    console.log(`[EmailService] OTP successfully sent to ${cleanEmail}`);
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
