'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  KeyRound
} from 'lucide-react';

function TeacherLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/teacher/dashboard';
  const errorParam = searchParams.get('error');
  const messageParam = searchParams.get('message');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password reset state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

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
      text: 'Your 8-hour administrator session has reached its absolute time limit. Please sign in again.',
    };
  } else if (errorParam === 'session_revoked') {
    bannerNotice = {
      type: 'info',
      text: 'Your previous session was securely terminated.',
    };
  } else if (errorParam === 'unauthorized_teacher_resource') {
    bannerNotice = {
      type: 'error',
      text: 'Access Restricted: Administrator credentials required to access that console.',
    };
  } else if (messageParam === 'logged_out') {
    bannerNotice = {
      type: 'info',
      text: 'You have been securely signed out.',
    };
  } else if (messageParam === 'password_updated') {
    bannerNotice = {
      type: 'info',
      text: 'Password updated successfully. Please sign in with your new password.',
    };
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      router.push(redirectPath);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request password reset.');
      setResetMsg({
        type: 'success',
        text: data.message || 'Password reset instructions have been dispatched.',
      });
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Failed to request password reset.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 flex items-center justify-center p-4 relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-32 -left-32 w-[650px] h-[650px] bg-emerald-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-32 -right-32 w-[600px] h-[600px] bg-teal-500/12" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs text-emerald-300/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Gateway</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <Link href="/" className="inline-block hover:scale-105 transition-transform">
            <div className="w-16 h-16 rounded-full bg-[#0a2318] border border-[#f5b335]/40 p-1 mx-auto shadow-[0_0_20px_rgba(245,179,53,0.3)] flex items-center justify-center">
              <img src="/logo.png" alt="Technosavvys Logo" className="w-full h-full object-contain rounded-full" />
            </div>
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-glow-emerald backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Administrator &amp; Faculty Console</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Admin / Teacher Login
          </h1>
          <p className="text-xs text-emerald-100/60 font-light max-w-sm mx-auto">
            Authorized management console for workshop sessions, QR attendance, and certificate publishing.
          </p>
        </div>

        {/* 3D Glass Login Card */}
        <div className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 shadow-glass relative border-emerald-500/30">
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

          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Admin Email or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                  placeholder="techno3deepak@gmail.com or username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-emerald-100/80">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email || 'techno3deepak@gmail.com');
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </form>
        </div>

        <p className="text-[11px] text-center text-emerald-100/40 font-light">
          Technosavvys Production Security • Server-Side Salted Cryptographic Authentication
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="card-3d-tilt glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full border border-emerald-500/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Admin Password</h3>
                <p className="text-xs text-emerald-100/60">Dispatches secure recovery instructions.</p>
              </div>
            </div>

            {resetMsg && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-start gap-2 ${
                  resetMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                {resetMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{resetMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleRequestPasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1">
                  Admin Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl glass-input placeholder-emerald-100/30"
                  placeholder="techno3deepak@gmail.com"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetMsg(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-emerald-200 text-xs font-semibold hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-60"
                >
                  {isResetting ? 'Dispatching...' : 'Send Recovery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-forest-950 flex items-center justify-center text-xs text-emerald-400">
          Loading authentication gate...
        </div>
      }
    >
      <TeacherLoginContent />
    </Suspense>
  );
}
