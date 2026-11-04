import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminIdentifier, ADMIN_EMAIL } from '@/lib/adminAuth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Audit the request
    await logAuditEvent({
      action: 'ADMIN_PASSWORD_RESET_REQUEST',
      entityType: 'Auth',
      details: { email: cleanEmail },
    });

    // 1. If Supabase is connected, trigger official password reset email
    try {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/teacher/login?message=reset_requested`,
      });
    } catch (e) {
      // Ignored for offline/fallback mode
    }

    // Always return neutral confirmation to avoid email enumeration
    return NextResponse.json({
      success: true,
      message:
        'If an authorized administrator account exists for this address, password recovery instructions have been dispatched.',
    });
  } catch (err: any) {
    console.error('[Reset Password API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Error processing password recovery request.' },
      { status: 500 }
    );
  }
}

