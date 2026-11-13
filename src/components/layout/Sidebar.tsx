'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  CalendarCheck2,
  Users,
  GraduationCap,
  BarChart3,
  Award,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const pathname = usePathname();
  const { workshops, certificates, attendance } = useApp();

  const ongoingCount = workshops.filter((w) => w.status === 'Ongoing' || w.status === 'Upcoming').length;
  const pendingCertsCount = certificates.filter((c) => c.status === 'Pending').length;

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Workshops',
      href: '/workshops',
      icon: CalendarCheck2,
      badge: ongoingCount > 0 ? `${ongoingCount} active` : null,
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
    },
    {
      label: 'Attendance',
      href: '/attendance',
      icon: Users,
      badge: `${attendance.length} logs`,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Students',
      href: '/students',
      icon: GraduationCap,
      badge: null,
    },
    {
      label: 'Reports & Analytics',
      href: '/reports',
      icon: BarChart3,
      badge: null,
    },
    {
      label: 'Certificates',
      href: '/certificates',
      icon: Award,
      badge: pendingCertsCount > 0 ? `${pendingCertsCount} pending` : null,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#0a2318] border border-[#f5b335]/40 p-0.5 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                  Technosavvys
                </span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 uppercase tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Workshop Management
              </p>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-4 py-5 overflow-y-auto space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Main Management
          </div>

          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 opacity-75" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Public Student Portal Link */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/portal"
            target="_blank"
            className="flex items-center justify-between p-2.5 rounded-xl bg-brand-50/70 hover:bg-brand-100/80 dark:bg-brand-950/40 dark:hover:bg-brand-900/50 border border-brand-200/70 dark:border-brand-800/60 text-brand-700 dark:text-brand-300 text-xs font-semibold transition-all group"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform" />
              <span>Student Certificate Portal</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
          </Link>
        </div>

        {/* Bottom Workspace Status Card */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    System Operational
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  v2.4.0 • Enterprise Cloud
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

