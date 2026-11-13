'use client';

import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

interface AppHeaderProps {
  roleBadge?: string;
  badgeColor?: 'gold' | 'emerald' | 'teal';
  showHome?: boolean;
  children?: React.ReactNode;
}

export function HomeNavLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-[#f5c542]/15 border border-white/15 hover:border-[#f5c542]/40 text-xs font-semibold text-white hover:text-[#f5c542] transition-all cursor-pointer shadow-sm"
    >
      <Home className="w-3.5 h-3.5 text-[#f5c542]" />
      <span>Home</span>
    </Link>
  );
}

export default function AppHeader({
  roleBadge,
  badgeColor = 'gold',
  showHome = false,
  children,
}: AppHeaderProps) {
  const badgeClasses =
    badgeColor === 'emerald'
      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
      : badgeColor === 'teal'
      ? 'bg-teal-500/15 border-teal-500/35 text-teal-300'
      : 'bg-[rgba(245,197,66,0.15)] border-[rgba(245,197,66,0.35)] text-[#f5c542]';

  return (
    <header className="tech-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <div className="logo-circle">
            <img src="/logo.png" alt="technosavvys logo" />
          </div>
          <div className="brand-div" />
          <div>
            <h2>technosavvys</h2>
            <p>creating smarter tomorrow!</p>
          </div>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {roleBadge && (
            <span
              className={`hidden md:inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${badgeClasses}`}
            >
              {roleBadge}
            </span>
          )}

          {showHome && <HomeNavLink />}

          {children ? (
            children
          ) : (
            <nav className="tech-nav">
              <HomeNavLink />
              <Link href="/#portals" className="pbtn">
                👤 Login Portal
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

