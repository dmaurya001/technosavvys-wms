'use client';

import React, { useState, useEffect, Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Award,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import AppHeader, { HomeNavLink } from '@/components/layout/AppHeader';

function CheckInForm({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const exp = searchParams.get('exp');

  const wsParam = searchParams.get('ws') || '';
  const titleParam = searchParams.get('title') || '';
  const { getSessionById, recordPublicCheckIn } = useApp();
  const sessionLookup = getSessionById(sessionId);

  // If session not found in local client state (e.g. mobile scanner), construct valid fallback session if token present
  const fallbackLookup = token ? {
    workshop: {
      id: wsParam || sessionId.replace(/^SESS-/, '').replace(/-\d+$/, ''),
      title: titleParam || 'Technical Workshop',
      category: 'Web Dev' as const,
      status: 'Ongoing' as const,
    },
    session: {
      id: sessionId,
      workshopId: wsParam || sessionId.replace(/^SESS-/, '').replace(/-\d+$/, ''),
      sessionTitle: 'Session 1: Main Workshop',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '05:00 PM',
      location: 'Lab 2, Tech Campus / Virtual',
      status: 'Live' as const,
      isActive: true,
      qrToken: token,
    }
  } : null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLookup = mounted ? (sessionLookup || fallbackLookup) : (fallbackLookup || sessionLookup);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('B.Tech - Computer Science & Engineering');

  const [isLoading, setIsLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    record?: any;
    code?: string;
  } | null>(null);

  // Check if session exists
  if (!activeLookup) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center p-4 text-emerald-100 relative overflow-hidden">
        <div className="ambient-glow top-1/4 left-1/3 w-96 h-96 bg-rose-500/10" />
        <div className="max-w-md w-full p-8 text-center glass-panel rounded-[32px] relative z-10 space-y-4 border-rose-500/30">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Invalid Workshop Session</h2>
          <p className="text-xs text-emerald-100/60 font-light">
            Session ID &quot;{sessionId}&quot; was not found in the workshop registry.
          </p>
          <Link href="/#portals">
            <button className="mt-2 px-5 py-2 text-xs font-semibold rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/20 text-white transition-all">
              Return to Portal
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const { workshop, session } = activeLookup;

  // Check if session is closed/deactivated
  const isSessionClosed =
    session.isActive === false ||
    session.status === 'Cancelled' ||
    session.status === 'Completed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitResult(null);

    try {
      // Validate phone format (minimum 10 digits)
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        setSubmitResult({
          success: false,
          message: 'Please enter a valid 10-digit mobile number.',
        });
        setIsLoading(false);
        return;
      }

      // Check QR token presence
      if (!token) {
        setSubmitResult({
          success: false,
          message: 'Missing or expired dynamic QR token. Please scan the current live QR code on screen.',
          code: 'QR_TOKEN_MISSING',
        });
        setIsLoading(false);
        return;
      }

      // Submit via Server-side Attendance API
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: workshop.id,
          workshopTitle: workshop.title,
          sessionTitle: session.sessionTitle,
          sessionId: session.id,
          token,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone.slice(-10),
          course: course.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({
          success: false,
          message: data.error || 'Failed to submit attendance.',
          code: data.code,
        });
        return;
      }

      // Sync into client state as well if available locally
      if (sessionLookup) {
        recordPublicCheckIn({
          sessionId: session.id,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone.slice(-10),
          course: course.trim(),
        });
      }

      setSubmitResult({
        success: true,
        message: 'Attendance recorded with status PENDING_REVIEW. Awaiting teacher approval.',
        record: data.record,
      });
    } catch (err: any) {
      setSubmitResult({
        success: false,
        message: err.message || 'An error occurred while registering attendance.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tech-page-bg flex flex-col min-h-screen relative overflow-hidden antialiased">
      {/* 3D Forest Emerald Lighting */}
      <div className="ambient-glow -top-32 -left-32 w-[600px] h-[600px] bg-emerald-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-32 -right-32 w-[600px] h-[600px] bg-teal-500/12" />

      {/* Official Branded Header */}
      <AppHeader roleBadge="QR Check-In" badgeColor="emerald">
        <div className="flex items-center gap-2.5">
          <HomeNavLink />
          <Link href="/student/portal" className="pbtn text-xs">
            Student Portal &rarr;
          </Link>
        </div>
      </AppHeader>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-lg space-y-6">
          {/* Header Description */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Register Session Attendance
            </h1>
            <p className="text-xs text-emerald-100/60 font-light max-w-md mx-auto">
              Dynamic QR verification enabled. Attendance will be submitted with initial status PENDING_REVIEW.
            </p>
          </div>

        {/* 3D Glass Workshop Session Info Card */}
        <div suppressHydrationWarning className="card-3d-tilt glass-panel rounded-3xl p-5 border-emerald-500/25 space-y-3 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span suppressHydrationWarning className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                {workshop.category}
              </span>
              <h2 suppressHydrationWarning className="text-base sm:text-lg font-bold text-white mt-0.5">
                {workshop.title}
              </h2>
              <p suppressHydrationWarning className="text-xs text-emerald-100/70 mt-0.5 font-medium">
                {session.sessionTitle}
              </p>
            </div>
            <div className="shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${
                  isSessionClosed
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {!isSessionClosed && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                {isSessionClosed ? 'Session Closed' : 'Live Session'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/[0.08] text-xs text-emerald-100/75 font-light">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span suppressHydrationWarning>{session.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span suppressHydrationWarning>{session.startTime} - {session.endTime}</span>
            </div>
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span suppressHydrationWarning className="truncate">{session.location}</span>
            </div>
          </div>
        </div>

        {/* Closed Session Banner */}
        {isSessionClosed ? (
          <div className="card-3d-tilt glass-panel rounded-[32px] p-8 text-center border-rose-500/30 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Attendance Closed</h3>
            <p className="text-xs text-rose-200/80 max-w-sm mx-auto font-light">
              This session is closed or cancelled and cannot accept new attendance submissions.
            </p>
          </div>
        ) : (
          /* Attendance Form or Success Card */
          <div className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 shadow-glass relative border-emerald-500/30">
            {submitResult ? (
              <div className="text-center py-6 space-y-5">
                {submitResult.success ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-glow-emerald">
                      <Clock className="w-9 h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                        Initial Status: PENDING_REVIEW
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-2">
                        Attendance Submitted Successfully!
                      </h3>
                      <p className="text-xs text-emerald-100/70 max-w-sm mx-auto font-light">
                        Your attendance has been logged with server timestamp. The workshop administrator will review and approve your submission for certificate eligibility.
                      </p>
                    </div>

                    {submitResult.record && (
                      <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-left text-xs space-y-2 text-emerald-100/80">
                        <div className="flex justify-between">
                          <span className="text-emerald-100/50">Student:</span>
                          <span className="font-semibold text-white">{submitResult.record.studentName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-100/50">Email:</span>
                          <span className="font-mono text-emerald-200">{submitResult.record.studentEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-100/50">Server Timestamp:</span>
                          <span className="font-mono text-[11px] text-teal-300">
                            {new Date(submitResult.record.serverTimestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-white/[0.05]">
                          <span className="text-emerald-100/50">Approval Status:</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            PENDING_REVIEW
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2.5">
                      <Link
                        href="/certificates"
                        className="inline-flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold py-2.5 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/15"
                      >
                        <Award className="w-3.5 h-3.5 text-teal-400" />
                        <span>Public Certificate Portal (/certificates) &rarr;</span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-9 h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-bold text-white">Submission Rejected</h3>
                      <p className="text-xs text-rose-200/80 max-w-sm mx-auto font-light">
                        {submitResult.message}
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setSubmitResult(null)}
                        className="px-6 py-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs text-rose-200 font-semibold transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                    Full Name <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                      placeholder="e.g. Aditya Verma"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                    Official Email Address <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                      placeholder="student@university.edu"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                    Mobile Number (10 Digits) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                    Degree Course / Branch
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="text"
                      required
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                      placeholder="B.Tech Computer Science"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>{isLoading ? 'Verifying QR Token...' : 'Submit Attendance for Review'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </button>
                </div>

                <p className="text-[10px] text-center text-emerald-100/40 pt-1 font-light">
                  Server timestamp and rotating token verification active. Duplicate submissions are blocked.
                </p>
              </form>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function AttendanceCheckInPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-forest-950 flex items-center justify-center text-xs text-emerald-400">Loading dynamic check-in gate...</div>}>
      <CheckInForm sessionId={resolvedParams.sessionId} />
    </Suspense>
  );
}
