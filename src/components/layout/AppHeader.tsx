'use client';

import React from 'react';
import Link from 'next/link';

interface AppHeaderProps {
  roleBadge?: string;
  badgeColor?: 'gold' | 'emerald' | 'teal';
  children?: React.ReactNode;
}

export default function AppHeader({
  roleBadge,
  badgeColor = 'gold',
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

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {roleBadge && (
            <span
              className={`hidden md:inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${badgeClasses}`}
            >
              {roleBadge}
            </span>
          )}

          {children ? (
            children
          ) : (
            <nav className="tech-nav">
              <Link href="/" className="link">
                Home
              </Link>
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
