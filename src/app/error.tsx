'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#241d63] text-white flex items-center justify-center p-6 overflow-x-hidden">
      <div className="max-w-md w-full rounded-3xl bg-[#19134a]/95 border border-[#f9b233]/35 p-8 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ee4035]/15 border border-[#ee4035]/40 flex items-center justify-center text-[#ee4035]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-xs text-[#e2e0f5]/80 leading-relaxed">
            An unexpected error occurred while loading this page. Your database records remain safe.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f9b233] hover:brightness-110 text-[#19134a] text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 hover:bg-white/10 text-emerald-100 text-xs font-semibold transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
