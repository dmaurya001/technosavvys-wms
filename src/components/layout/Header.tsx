'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '../ui/Button';
import {
  Menu,
  Search,
  Moon,
  Sun,
  Bell,
  Plus,
  QrCode,
  Sparkles,
  ArrowRight,
  User,
  GraduationCap,
  Calendar,
  CheckCircle2,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit';

interface HeaderProps {
  onOpenMobile: () => void;
  onOpenNewWorkshop?: () => void;
  onOpenQuickAttendance?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobile,
  onOpenNewWorkshop,
  onOpenQuickAttendance,
}) => {
  const { darkMode, toggleDarkMode, workshops, students, certificates, attendance } = useApp();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    document.cookie = 'technosavvys_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    await logAuditEvent({
      action: 'ADMIN_LOGOUT',
      entityType: 'Auth',
      details: { timestamp: new Date().toISOString() },
    });
    router.push('/login');
  };

  // Close search and notif on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredWorkshops = workshops.filter(
    (w) =>
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.trainer.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 3);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.regNo.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 3);

  const recentAttendance = attendance.slice(0, 4);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Mobile toggle and Title/Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>Technosavvys</span>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">Enterprise Hub</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workshops, students, roll no..."
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            className="w-full pl-10 pr-4 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-lg border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
          />
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in-50">
            {filteredWorkshops.length === 0 && filteredStudents.length === 0 ? (
              <p className="text-xs text-slate-400 p-2 text-center">No matching records found.</p>
            ) : (
              <div className="space-y-3">
                {filteredWorkshops.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2">
                      Workshops
                    </span>
                    <div className="mt-1 space-y-1">
                      {filteredWorkshops.map((w) => (
                        <Link
                          key={w.id}
                          href="/workshops"
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-brand-500" />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {w.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{w.trainer}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredStudents.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2">
                      Students
                    </span>
                    <div className="mt-1 space-y-1">
                      {filteredStudents.map((s) => (
                        <Link
                          key={s.id}
                          href="/students"
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {s.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{s.regNo}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {onOpenQuickAttendance && (
          <Button
            size="sm"
            variant="outline"
            icon={<QrCode className="w-3.5 h-3.5 text-emerald-500" />}
            onClick={onOpenQuickAttendance}
            className="hidden sm:inline-flex"
          >
            Scan QR
          </Button>
        )}

        {onOpenNewWorkshop && (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenNewWorkshop}
          >
            New Workshop
          </Button>
        )}

        {/* Theme switch */}
        <button
          onClick={toggleDarkMode}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Popover */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Recent Activities
                </span>
                <span className="text-[10px] font-medium text-brand-600 dark:text-brand-400">
                  Live Feed
                </span>
              </div>

              <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto">
                {recentAttendance.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {a.studentName} marked {a.status}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {a.workshopTitle.slice(0, 32)}... • {a.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link
                  href="/attendance"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                >
                  View complete attendance logs <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User profile avatar badge */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            D
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              dmaurya001
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">Lead Administrator</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out of Admin Console"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

