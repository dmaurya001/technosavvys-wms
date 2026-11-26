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
      <body className="min-h-screen bg-[#241d63] text-white flex items-center justify-center p-6 font-sans overflow-x-hidden">
        <div className="max-w-md w-full rounded-3xl bg-[#19134a] border border-[#f9b233]/35 p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">Application Error</h2>
          <p className="text-xs text-[#e2e0f5]/80">
            A critical rendering error occurred. Reload to restore your session.
          </p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-[#f9b233] text-[#19134a] text-xs font-bold cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
