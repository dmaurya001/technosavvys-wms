import Link from 'next/link';
import AppHeader, { HomeNavLink } from '@/components/layout/AppHeader';

export default function NotFound() {
  return (
    <div className="tech-page-bg min-h-screen text-white flex flex-col relative overflow-hidden antialiased">
      <AppHeader roleBadge="404" badgeColor="gold">
        <HomeNavLink />
      </AppHeader>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="tech-glass-card rounded-[32px] p-8 sm:p-12 max-w-md w-full space-y-4">
          <h1 className="text-6xl font-black text-[#f5c542] tracking-tight">404</h1>
          <h2 className="text-xl font-bold text-white">Page Not Found</h2>
          <p className="text-xs text-[#d6f5ec]/70">
            The page you are looking for does not exist or has been moved to another location.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#f5c542] hover:bg-[#e5b532] text-[#04201c] font-bold text-xs transition-all shadow-md"
            >
              Return to Home &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

