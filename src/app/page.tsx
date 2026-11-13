'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Sparkles, ArrowRight, Calendar, Users, Award, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Workshop } from '@/types';

export default function LandingPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkshops() {
      try {
        const res = await fetch('/api/workshops');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.workshops)) {
            setWorkshops(data.workshops);
          }
        }
      } catch (err) {
        console.warn('Failed loading workshops:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWorkshops();
  }, []);

  return (
    <div className="min-h-screen bg-[#04160e] text-emerald-50 relative overflow-x-hidden antialiased selection:bg-[#f5b335] selection:text-slate-950 font-sans">
      {/* Ambient Deep Forest Background Glows */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[700px] h-[700px] bg-emerald-600/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 -right-40 w-[650px] h-[650px] bg-teal-600/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 w-[700px] h-[700px] bg-emerald-500/8 rounded-full blur-[140px]" />

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#04160e]/85 backdrop-blur-md border-b border-emerald-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center group">
            <div className="w-11 h-11 rounded-full p-0.5 bg-[#0a2318] border border-[#f5b335]/40 shadow-[0_0_15px_rgba(245,179,53,0.2)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/logo.png"
                alt="technosavvys logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="h-7 w-[1px] bg-emerald-500/30 mx-3 hidden xs:block" />
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-none">
                technosavvys
              </span>
              <span className="text-[11px] sm:text-xs italic text-emerald-200/80 font-light mt-1">
                creating smarter tomorrow!
              </span>
            </div>
          </Link>

          {/* Navigation Links & Login */}
          <nav className="flex items-center gap-4 sm:gap-7">
            <a
              href="#about"
              className="text-xs sm:text-sm font-medium text-emerald-100/90 hover:text-white transition-colors"
            >
              About
            </a>
            <a
              href="#workshop"
              className="text-xs sm:text-sm font-medium text-emerald-100/90 hover:text-white transition-colors"
            >
              Workshop
            </a>
            <Link
              href="#portals"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-xs sm:text-sm font-semibold text-emerald-100 hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            >
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>Login Portal</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
                Learn technology.<br />
                Build what&apos;s next.
              </h1>
              <p className="text-base sm:text-lg text-emerald-100/75 font-light max-w-xl leading-relaxed">
                A hands-on workshop and community to learn modern technologies, build real projects, and grow together as future-ready creators.
              </p>
              <div className="pt-2">
                <a
                  href="#workshop"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-bold text-slate-950 bg-[#f5b335] hover:bg-[#eab308] shadow-[0_0_25px_rgba(245,179,53,0.45)] hover:shadow-[0_0_35px_rgba(245,179,53,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer text-sm sm:text-base"
                >
                  <span>Explore Workshop</span>
                  <span className="text-lg leading-none">&rarr;</span>
                </a>
              </div>
            </div>

            {/* Right Graphic: 3D Glowing Sphere with Orbital Rings */}
            <div className="lg:col-span-5 flex items-center justify-center relative py-6">
              <div className="relative w-72 h-72 sm:w-88 sm:h-88 flex items-center justify-center">
                {/* Orbital Rings SVG */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 320 320"
                >
                  <defs>
                    <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f5b335" stopOpacity="0.95" />
                      <stop offset="50%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="ringGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
                      <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#047857" stopOpacity="0.25" />
                    </linearGradient>
                  </defs>
                  {/* Orbit Ring 1 (Tilted Golden) */}
                  <ellipse
                    cx="160"
                    cy="160"
                    rx="145"
                    ry="52"
                    fill="none"
                    stroke="url(#ringGrad1)"
                    strokeWidth="2.5"
                    transform="rotate(-15 160 160)"
                  />
                  {/* Orbit Ring 2 (Counter tilted emerald-gold) */}
                  <ellipse
                    cx="160"
                    cy="160"
                    rx="140"
                    ry="46"
                    fill="none"
                    stroke="url(#ringGrad2)"
                    strokeWidth="1.8"
                    transform="rotate(22 160 160)"
                  />
                </svg>

                {/* 3D Glowing Green Sphere */}
                <div
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-full relative shadow-[0_0_70px_rgba(16,185,129,0.4)] flex items-center justify-center"
                  style={{
                    background:
                      'radial-gradient(circle at 45% 35%, #fde047 0%, #f59e0b 6%, #10b981 32%, #059669 60%, #064e3b 85%, #022c22 100%)',
                  }}
                >
                  {/* Soft specular light on surface */}
                  <div className="absolute top-5 left-8 w-14 h-8 rounded-full bg-white/20 blur-[2px] transform -rotate-25" />
                  {/* Subtle inner core glow */}
                  <div className="w-10 h-10 rounded-full bg-yellow-200/40 blur-md" />
                </div>

                {/* Ground Shadow */}
                <div className="absolute -bottom-4 w-44 sm:w-52 h-6 bg-black/60 blur-md rounded-full pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ABOUT THE WORKSHOP CARD */}
          <div id="about" className="mt-14 sm:mt-20 scroll-mt-24">
            <div className="rounded-2xl p-6 sm:p-8 bg-[#061e14]/90 border border-[#f5b335]/65 shadow-[0_0_20px_rgba(245,179,53,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur-md">
              <div className="space-y-2 max-w-3xl">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  About the Workshop
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/75 leading-relaxed font-light">
                  technosavvys is a technology workshop and learning community that offers practical, project-based sessions, mentorship, and a collaborative space to build real-world solutions.
                </p>
              </div>
              <div className="shrink-0 text-left md:text-right border-t md:border-t-0 md:border-l border-[#f5b335]/30 pt-4 md:pt-0 md:pl-8">
                <span className="text-xs uppercase tracking-wider text-emerald-300/80 font-medium">
                  Founded
                </span>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#f5b335] mt-0.5 tracking-tight">
                  2023
                </p>
              </div>
            </div>
          </div>

          {/* CHOOSE YOUR PORTAL SECTION */}
          <div id="portals" className="mt-20 sm:mt-28 scroll-mt-24">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                Choose your portal
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
              {/* CARD 1: Admin Login */}
              <div className="rounded-2xl p-6 sm:p-8 bg-[#061e14]/90 border border-[#f5b335]/65 shadow-[0_0_25px_rgba(245,179,53,0.14)] flex flex-col justify-between backdrop-blur-md hover:border-[#f5b335] transition-all">
                <div className="space-y-2.5">
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Admin Login
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/75 leading-relaxed font-light">
                    Access workshop management, participants, and resources.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/teacher/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-slate-950 bg-[#f5b335] hover:bg-[#eab308] shadow-[0_0_20px_rgba(245,179,53,0.35)] hover:shadow-[0_0_30px_rgba(245,179,53,0.55)] transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    <span>Admin Login</span>
                    <span className="text-base leading-none">&rarr;</span>
                  </Link>
                </div>
              </div>

              {/* CARD 2: Student Login */}
              <div className="rounded-2xl p-6 sm:p-8 bg-[#061e14]/90 border border-[#f5b335]/65 shadow-[0_0_25px_rgba(245,179,53,0.14)] flex flex-col justify-between backdrop-blur-md hover:border-[#f5b335] transition-all">
                <div className="space-y-2.5">
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Student Login
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/75 leading-relaxed font-light">
                    Join the workshop, access your materials, and track your progress.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/student/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-slate-950 bg-[#f5b335] hover:bg-[#eab308] shadow-[0_0_20px_rgba(245,179,53,0.35)] hover:shadow-[0_0_30px_rgba(245,179,53,0.55)] transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    <span>Student Login</span>
                    <span className="text-base leading-none">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE WORKSHOPS SECTION */}
          <div id="workshop" className="mt-20 sm:mt-28 scroll-mt-24">
            <div className="text-center mb-8">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                Current Programs
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-3">
                Live &amp; Upcoming Workshops
              </h2>
            </div>

            {workshops.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {workshops.map((ws) => (
                  <div
                    key={ws.id}
                    className="rounded-2xl p-6 bg-[#061e14]/90 border border-emerald-500/30 shadow-glass flex flex-col justify-between hover:border-[#f5b335]/70 transition-all group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                          {ws.category}
                        </span>
                        <span className="text-xs text-emerald-300/80 font-mono">
                          {ws.id}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-[#f5b335] transition-colors">
                        {ws.title}
                      </h3>
                      <p className="text-xs text-emerald-100/70 line-clamp-2">
                        {ws.description || 'Hands-on practical workshop by Technosavvys.'}
                      </p>
                      <div className="space-y-1.5 pt-2 text-xs text-emerald-100/80">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{ws.date} ({ws.time})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-teal-400" />
                          <span>Trainer: {ws.trainer}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-emerald-900/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-300">
                        {ws.status}
                      </span>
                      <Link
                        href="/student/login"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-[#f5b335] hover:text-slate-950 border border-emerald-500/30 text-xs font-semibold text-emerald-200 transition-all"
                      >
                        <span>Join / Verify</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-md mx-auto text-center p-8 rounded-2xl bg-[#061e14]/70 border border-emerald-500/20">
                <Award className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-bold text-white">Workshop Enrollment</h3>
                <p className="text-xs text-emerald-100/70 mt-1">
                  Access your participant credentials and attendance via the Student Login portal.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-emerald-950/80 bg-[#020d08] py-8 text-center text-xs text-emerald-100/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full object-contain" />
            <span className="font-bold text-white">technosavvys</span>
            <span className="text-emerald-500/40">|</span>
            <span className="italic text-emerald-300/70">creating smarter tomorrow!</span>
          </div>
          <p>&copy; {new Date().getFullYear()} technosavvys. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
