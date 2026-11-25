import { NextRequest, NextResponse } from 'next/server';
import { getAllCertificates } from '@/lib/certificateStore';
import { isMySQLConfigured, executeMySQLQuery } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const certNo = (searchParams.get('certNo') || '').trim();

    if (!certNo) {
      return NextResponse.json(
        { verified: false, error: 'Certificate number is required.' },
        { status: 400 }
      );
    }

    if (isMySQLConfigured()) {
      const rows = await executeMySQLQuery<any[]>(
        `SELECT certificate_no, student_name, workshop_title, issue_date, trainer_name, grade, verification_code, score
         FROM certificates
         WHERE certificate_no = ? OR verification_code = ?
         LIMIT 1`,
        [certNo, certNo]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        return NextResponse.json({
          verified: true,
          certificate: {
            certificateNo: r.certificate_no,
            studentName: r.student_name,
            workshopTitle: r.workshop_title,
            issueDate: r.issue_date,
            trainer: r.trainer_name,
            grade: r.grade,
            score: r.score,
            verificationCode: r.verification_code,
            status: 'Issued',
          },
        });
      }
    }

    const all = await getAllCertificates();
    const match = all.find(
      (c) =>
        c.certificateNo?.toLowerCase() === certNo.toLowerCase() ||
        c.id?.toLowerCase() === certNo.toLowerCase()
    );

    if (!match) {
      return NextResponse.json(
        { verified: false, error: 'Certificate not found or invalid verification code.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verified: true,
      certificate: {
        certificateNo: match.certificateNo || match.id,
        studentName: match.studentName,
        workshopTitle: match.workshopTitle || 'Technical Workshop',
        issueDate: match.issueDate || '',
        trainer: match.trainer || 'Lead Instructor',
        grade: match.grade || 'Distinction',
        score: match.score || '95%',
        verificationCode: match.certificateNo || match.id,
        status: match.status || 'Issued',
      },
    });
  } catch (err: any) {
    console.error('[API /api/certificates/verify GET Error]:', err);
    return NextResponse.json(
      { verified: false, error: 'Verification service error.' },
      { status: 500 }
    );
  }
}
