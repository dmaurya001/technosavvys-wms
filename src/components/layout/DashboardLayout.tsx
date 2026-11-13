'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ToastContainer } from '../ui/ToastContainer';
import { Button } from '../ui/Button';
import {
  Sparkles,
  ExternalLink,
  LogOut,
  Award,
  ShieldCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  // Check if current page renders its own dedicated header to prevent duplication
  const hasDedicatedHeader =
    pathname === '/' ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/certificates') ||
    pathname.startsWith('/attendance') ||
    pathname.startsWith('/checkin') ||
    pathname.startsWith('/login') ||
    pathname === '/portal';

  if (hasDedicatedHeader) {
    return (
      <div className="min-h-screen bg-forest-950 text-emerald-50 flex flex-col relative overflow-hidden antialiased selection:bg-emerald-500 selection:text-slate-950">
        {/* Background ambient lighting */}
        <div className="ambient-glow -top-32 -left-32 w-[600px] h-[600px] bg-emerald-500/10" />
        <div className="ambient-glow top-1/2 -right-40 w-[550px] h-[550px] bg-teal-500/10" />
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
        <ToastContainer />
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    document.cookie = 'technosavvys_admin_session=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 flex flex-col relative overflow-hidden antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-40 -left-32 w-[650px] h-[650px] bg-emerald-500/12 animate-pulse-subtle" />
      <div className="ambient-glow top-1/3 -right-44 w-[600px] h-[600px] bg-teal-500/10" />
      <div className="ambient-glow bottom-0 left-1/4 w-[700px] h-[400px] bg-emerald-600/8" />

      {/* Floating Glass Top Navigation Bar */}
      <header className="sticky top-4 z-40 max-w-5xl w-[92%] sm:w-full mx-auto mt-4 px-4 sm:px-6 h-16 rounded-full glass-panel flex items-center justify-between shadow-glass">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full bg-[#0a2318] border border-[#f5b335]/40 p-0.5 flex items-center justify-center shadow-glow-emerald group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                Technosavvys
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-emerald-100/50 hidden sm:block">
              Workshop Attendance &amp; Credentials
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/portal" target="_blank">
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-emerald-100 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:brightness-105">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Student Portal</span>
              <ExternalLink className="w-3 h-3 text-emerald-400/70" />
            </button>
          </Link>

          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Single Page Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 relative z-10">
        {children}
      </main>

      {/* Simple Glass Footer */}
      <footer className="border-t border-emerald-900/40 py-6 px-6 text-center text-xs text-emerald-100/40 relative z-10">
        <p>Technosavvys Workshop Attendance System &copy; 2026. Premium 3D Glassmorphism Architecture.</p>
      </footer>

      {/* Notification Toasts */}
      <ToastContainer />
    </div>
  );
};
