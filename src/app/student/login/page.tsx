'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Award,
  Sparkles,
  ShieldCheck,
  Phone,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/student/portal';
  const errorParam = searchParams.get('error');
  const messageParam = searchParams.get('message');

  // Step 1: phone input, Step 2: OTP verification
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Compute banner notice based on URL params
  let bannerNotice: { type: 'warning' | 'error' | 'info'; text: string } | null = null;
  if (errorParam === 'session_idle_timeout') {
    bannerNotice = {
      type: 'warning',
      text: 'You were automatically logged out due to 15 minutes of inactivity.',
    };
  } else if (errorParam === 'session_expired') {
    bannerNotice = {
      type: 'warning',
      text: 'Your 2-hour student session has expired. Please verify your OTP to sign in again.',
    };
  } else if (errorParam === 'session_revoked') {
    bannerNotice = {
      type: 'info',
      text: 'Your student session was securely signed out.',
    };
  } else if (errorParam === 'unauthorized_student_resource') {
    bannerNotice = {
      type: 'error',
      text: 'Please log in with student credentials to access this portal.',
    };
  } else if (messageParam === 'logged_out') {
    bannerNotice = {
      type: 'info',
      text: 'You have been securely signed out.',
    };
  }

  // Timer for OTP resend
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessNotice(null);

    try {
      const cleanPhone = mobileNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        throw new Error('Please enter a valid 10-digit registered mobile number.');
      }

      const res = await fetch('/api/portal/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          mobileNumber: cleanPhone.slice(-10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to request verification code.');
      }

      setStep('otp');
      setCountdown(45);
      setSuccessNotice('6-digit verification code sent to your registered mobile number.');

      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending OTP. Please check your number.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);

      const res = await fetch('/api/portal/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber: cleanPhone,
          otp: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }

      // Secure session cookie is set directly by the server (HttpOnly, Secure, SameSite)
      router.push(redirectPath);
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoStudent = () => {
    setFullName('Aditya Verma');
    setMobileNumber('9876543210');
  };

  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 flex items-center justify-center p-4 relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-32 -left-32 w-[650px] h-[650px] bg-teal-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-32 -right-32 w-[600px] h-[600px] bg-emerald-500/12" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs text-teal-300/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Gateway</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-950/70 border border-teal-500/30 text-teal-300 text-xs font-semibold shadow-glow-emerald backdrop-blur-md">
            <Award className="w-3.5 h-3.5 text-teal-400" />
            <span>Student &amp; Attendee Gateway</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Student Login
          </h1>
          <p className="text-xs text-emerald-100/60 font-light max-w-sm mx-auto">
            Access your verified workshop attendance history and authentic digital certificates.
          </p>
        </div>

        {/* 3D Glass Login Card */}
        <div className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 shadow-glass relative border-teal-500/30">
          {bannerNotice && (
            <div
              className={`mb-4 p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                bannerNotice.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : bannerNotice.type === 'warning'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{bannerNotice.text}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {devOtpHint && (
            <div className="mb-4 p-3 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between">
              <span className="font-light">Sandbox Verification Code:</span>
              <span className="font-mono font-bold text-sm bg-teal-950/80 px-2.5 py-0.5 rounded border border-teal-400/40 text-teal-200">
                {devOtpHint}
              </span>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                  placeholder="e.g. Aditya Verma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                  Registered Mobile Number <span className="text-teal-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60" />
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                    placeholder="9876543210"
                  />
                </div>
                <p className="text-[11px] text-emerald-100/40 mt-1">
                  Enter the 10-digit number used during workshop registration.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60"
              >
                <span>{isLoading ? 'Sending Code...' : 'Request Verification OTP'}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              {/* Demo Fill Button */}
              <div className="pt-3 border-t border-white/[0.08] text-center">
                <button
                  type="button"
                  onClick={handleQuickDemoStudent}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
                >
                  ⚡ Auto-fill registered student demo (Aditya Verma)
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-emerald-100/80">
                    Enter 6-Digit OTP Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="text-[11px] text-teal-400 hover:text-teal-300"
                  >
                    Change Number
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-4 py-2.5 text-center tracking-widest text-base sm:text-lg rounded-2xl glass-input placeholder-emerald-100/30 font-mono font-bold"
                    placeholder="123456"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>{isLoading ? 'Verifying...' : 'Verify OTP & Enter Portal'}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              <div className="flex items-center justify-between text-xs text-emerald-100/50 pt-2">
                <span>Didn&apos;t receive code?</span>
                {countdown > 0 ? (
                  <span>Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    className="text-teal-400 hover:text-teal-300 font-semibold"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="text-[11px] text-center text-emerald-100/40 font-light">
          Technosavvys Student Cloud • Authenticated Cryptographic Access
        </p>
      </div>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-forest-950 flex items-center justify-center text-xs text-emerald-400">
          Loading student gate...
        </div>
      }
    >
      <StudentLoginContent />
    </Suspense>
  );
}

