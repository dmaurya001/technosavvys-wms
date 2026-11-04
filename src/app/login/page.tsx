'use client';

import React from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  QrCode,
  FileSpreadsheet,
  FileCheck,
  CheckCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';

export default function CommonLoginPage() {
  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden antialiased">
      {/* 3D Ambient Glowing Emerald Lights */}
      <div className="ambient-glow -top-40 -left-40 w-[680px] h-[680px] bg-emerald-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-40 -right-40 w-[680px] h-[680px] bg-teal-500/12" />
      <div className="ambient-glow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-700/10" />

      <div className="w-full max-w-5xl relative z-10 space-y-8 sm:space-y-10 my-auto">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-glow-emerald backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Technosavvys Academic Cloud Platform</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Authentication Gateway
          </h1>
          <p className="text-sm sm:text-base text-emerald-100/70 font-light max-w-xl mx-auto">
            Select your account category to proceed into the verified portal. Dedicated environments for faculty instructors and registered students.
          </p>
        </div>

        {/* Two 3D Glassmorphism Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* CARD 1: TEACHER LOGIN */}
          <div className="card-3d-tilt glass-panel rounded-[36px] p-6 sm:p-8 shadow-glass border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                  Educators &amp; Admins
                </span>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shadow-glow-emerald group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white group-hover:text-emerald-200 transition-colors">
                  Admin / Teacher Login
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/70 font-light mt-1.5 leading-relaxed">
                  Administrator &amp; instructor console for workshop scheduling, dynamic QR attendance generation, real-time rosters, and bulk certificate issuance.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Workshop Creation &amp; Live QR Generator</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Real-Time Attendance &amp; Formatted Excel Export</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>ZIP PDF Certificate Ingestion &amp; Name Matching</span>
                </div>
              </div>
            </div>

            <div className="pt-6 sm:pt-8 mt-4">
              <Link href="/teacher/login" className="block">
                <button className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-slate-950" />
                  <span>Sign In as Admin / Teacher</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </Link>
            </div>
          </div>

          {/* CARD 2: STUDENT LOGIN */}
          <div className="card-3d-tilt glass-panel rounded-[36px] p-6 sm:p-8 shadow-glass border-teal-500/30 hover:border-teal-400/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all pointer-events-none" />

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider">
                  Students &amp; Attendees
                </span>
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shadow-glow-emerald group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white group-hover:text-teal-200 transition-colors">
                  Student Login
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/70 font-light mt-1.5 leading-relaxed">
                  Secure student portal for verified attendees to view personal attendance history and download cryptographically issued certificates.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Passwordless Mobile Number &amp; OTP Login</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Personal Workshop Attendance History</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-emerald-100/80">
                  <Award className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Secure 60s Signed PDF Certificate Downloads</span>
                </div>
              </div>
            </div>

            <div className="pt-6 sm:pt-8 mt-4">
              <Link href="/student/login" className="block">
                <button className="w-full py-3.5 px-6 rounded-full bg-white/[0.1] hover:bg-white/[0.18] border border-white/20 text-emerald-100 font-bold text-xs sm:text-sm hover:-translate-y-0.5 hover:brightness-105 transition-all flex items-center justify-center gap-2">
                  <Award className="w-4 h-4 text-teal-400" />
                  <span>Sign In as Student</span>
                  <ArrowRight className="w-4 h-4 text-emerald-300" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="text-center space-y-1 pt-2">
          <p className="text-xs text-emerald-100/50 font-light">
            Technosavvys Academic Cloud ? Server-Enforced Role Separation &amp; Row Level Security
          </p>
        </div>
      </div>
    </div>
  );
}
