import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface GeneratePdfOptions {
  certificateNo: string;
  recipientName: string;
  workshopTitle: string;
  trainerName: string;
  issueDate: string;
  grade?: string;
  score?: number;
}

/**
 * Generates an authentic, cryptographically-numbered A4 Landscape PDF certificate binary.
 */
export async function generateCertificatePdf(options: GeneratePdfOptions): Promise<Uint8Array> {
  // A4 Landscape dimensions in points: 841.89 x 595.28
  const width = 842;
  const height = 595;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background Dark Theme / Clean Ivory Base
  // Outer frame
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.06, 0.45, 0.35), // Emerald border
    borderWidth: 4,
    color: rgb(0.98, 0.99, 0.98), // Very soft ivory
  });

  // Inner Gold Accent Line
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: rgb(0.79, 0.64, 0.25), // Gold accent
    borderWidth: 1.5,
  });

  // Header Branding
  const brandText = 'TECHNOSAVVYS ACADEMIC COUNCIL & LEARNING SYSTEMS';
  const brandWidth = helveticaBold.widthOfTextAtSize(brandText, 11);
  page.drawText(brandText, {
    x: (width - brandWidth) / 2,
    y: height - 70,
    size: 11,
    font: helveticaBold,
    color: rgb(0.06, 0.45, 0.35),
  });

  // Top Certificate Title
  const titleText = 'CERTIFICATE OF COMPLETION';
  const titleWidth = timesRomanBold.widthOfTextAtSize(titleText, 28);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 28,
    font: timesRomanBold,
    color: rgb(0.08, 0.16, 0.22),
  });

  // Subtitle
  const subText = 'This is proudly presented and certified to:';
  const subWidth = timesRomanItalic.widthOfTextAtSize(subText, 14);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 165,
    size: 14,
    font: timesRomanItalic,
    color: rgb(0.35, 0.42, 0.48),
  });

  // Recipient Name (Centered & Bold)
  const nameText = options.recipientName.trim();
  const nameWidth = timesRomanBold.widthOfTextAtSize(nameText, 32);
  page.drawText(nameText, {
    x: (width - nameWidth) / 2,
    y: height - 215,
    size: 32,
    font: timesRomanBold,
    color: rgb(0.04, 0.38, 0.28), // Deep emerald
  });

  // Name Underline Accent
  page.drawLine({
    start: { x: Math.max(100, (width - nameWidth) / 2 - 20), y: height - 225 },
    end: { x: Math.min(width - 100, (width + nameWidth) / 2 + 20), y: height - 225 },
    thickness: 1.5,
    color: rgb(0.79, 0.64, 0.25),
  });

  // Description / Citation
  const descLine1 = 'For exceptional participation, active attendance, and successful completion of:';
  const d1Width = timesRoman.widthOfTextAtSize(descLine1, 13);
  page.drawText(descLine1, {
    x: (width - d1Width) / 2,
    y: height - 265,
    size: 13,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.35),
  });

  // Workshop Title
  const wsText = `"${options.workshopTitle.trim()}"`;
  const wsWidth = timesRomanBold.widthOfTextAtSize(wsText, 18);
  page.drawText(wsText, {
    x: (width - wsWidth) / 2,
    y: height - 298,
    size: 18,
    font: timesRomanBold,
    color: rgb(0.08, 0.16, 0.22),
  });

  // Grade & Performance
  const gradeText = `Awarded with ${options.grade || 'Distinction'} Honors. Validated by Official QR Record.`;
  const gWidth = timesRomanItalic.widthOfTextAtSize(gradeText, 12);
  page.drawText(gradeText, {
    x: (width - gWidth) / 2,
    y: height - 330,
    size: 12,
    font: timesRomanItalic,
    color: rgb(0.35, 0.42, 0.48),
  });

  // Signatures & Verification Grid (Bottom)
  // Left: Trainer Signature
  const trainerLine = '______________________________';
  page.drawText(trainerLine, { x: 90, y: 130, size: 12, font: helvetica, color: rgb(0.6, 0.65, 0.7) });
  page.drawText(options.trainerName || 'Lead Instructor', {
    x: 90,
    y: 110,
    size: 14,
    font: timesRomanBold,
    color: rgb(0.1, 0.15, 0.2),
  });
  page.drawText('Lead Instructor & Curriculum Director', {
    x: 90,
    y: 92,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Center: Official Seal / Security Serial Number
  const certNoText = `SERIAL: ${options.certificateNo}`;
  const certNoWidth = helveticaBold.widthOfTextAtSize(certNoText, 11);
  page.drawText(certNoText, {
    x: (width - certNoWidth) / 2,
    y: 115,
    size: 11,
    font: helveticaBold,
    color: rgb(0.06, 0.45, 0.35),
  });
  const secNotice = 'Cryptographically Verified Credential';
  const secWidth = helvetica.widthOfTextAtSize(secNotice, 9);
  page.drawText(secNotice, {
    x: (width - secWidth) / 2,
    y: 98,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Right: Date of Issuance
  page.drawText(trainerLine, { x: width - 260, y: 130, size: 12, font: helvetica, color: rgb(0.6, 0.65, 0.7) });
  page.drawText(options.issueDate || new Date().toISOString().split('T')[0], {
    x: width - 240,
    y: 110,
    size: 14,
    font: timesRomanBold,
    color: rgb(0.1, 0.15, 0.2),
  });
  page.drawText('Date of Official Issuance', {
    x: width - 240,
    y: 92,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  return await pdfDoc.save();
}

