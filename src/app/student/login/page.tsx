'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import {
  Award,
  ShieldCheck,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/student/portal';
  const errorParam = searchParams.get('error');
  const messageParam = searchParams.get('message');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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
      text: 'Your student session has expired. Please sign in again with your email.',
    };
  } else if (errorParam === 'session_revoked') {
    bannerNotice = {
      type: 'info',
      text: 'Your student session was securely signed out.',
    };
  } else if (errorParam === 'unauthorized_student_resource') {
    bannerNotice = {
      type: 'error',
      text: 'Please log in with your registered email to access this portal.',
    };
  } else if (messageParam === 'logged_out') {
    bannerNotice = {
      type: 'info',
      text: 'You have been securely signed out.',
    };
  }

  // Direct Name + Email Login
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessNotice(null);

    try {
      if (!fullName.trim()) {
        throw new Error('Please enter your registered full name.');
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid registered email address.');
      }

      const res = await fetch('/api/portal/direct-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate. Please check your credentials.');
      }

      setSuccessNotice('Identity verified successfully! Redirecting to student portal...');
      setTimeout(() => {
        router.push(redirectPath);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error signing in. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoStudent = () => {
    setFullName('Aditya Verma');
    setEmail('aditya.verma@technosavvys.edu');
  };

  return (
    <div className="tech-page-bg flex flex-col min-h-screen relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-32 -left-32 w-[650px] h-[650px] bg-teal-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-32 -right-32 w-[600px] h-[600px] bg-emerald-500/12" />

      {/* Official Branded Header */}
      <AppHeader roleBadge="Student Portal" badgeColor="teal">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-white/80 hover:text-[#f5c542] transition-colors"
          >
            Home
          </Link>
          <Link href="/teacher/login" className="pbtn text-xs">
            Admin Login &rarr;
          </Link>
        </div>
      </AppHeader>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Header Description */}
          <div className="text-center space-y-2">
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

          <form onSubmit={handleDirectLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Full Name <span className="text-teal-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60" />
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
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Registered Email Address <span className="text-teal-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                  placeholder="e.g. aditya.verma@technosavvys.edu"
                />
              </div>
              <p className="text-[11px] text-emerald-100/40 mt-1">
                Enter the email address registered during workshop attendance.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60 cursor-pointer"
              >
                <Award className="w-4 h-4 text-slate-950" />
                <span>{isLoading ? 'Verifying Student...' : 'Access My Certificates'}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            </div>

            {/* Demo Fill Button */}
            <div className="pt-3 border-t border-white/[0.08] text-center">
              <button
                type="button"
                onClick={handleQuickDemoStudent}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
              >
                ⚡ Auto-fill registered student demo (Aditya Verma)
              </button>
            </div>
          </form>
        </div>

        <p className="text-[11px] text-center text-emerald-100/40 font-light">
          Technosavvys Student Cloud • Instant Name &amp; Email Credential Verification
        </p>
        </div>
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
