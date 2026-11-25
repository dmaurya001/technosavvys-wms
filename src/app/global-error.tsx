'use client';

import React from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#060f08] text-emerald-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl bg-[#0a1f14] border border-emerald-500/30 p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">Application Error</h2>
          <p className="text-xs text-emerald-100/70">
            A critical rendering error occurred. Reload to restore your session.
          </p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-emerald-950 text-xs font-bold cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
