import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#241d63] text-white flex flex-col items-center justify-center p-6 overflow-x-hidden">
      <div className="w-10 h-10 rounded-full border-2 border-[#f9b233]/30 border-t-[#f9b233] animate-spin" />
      <p className="mt-4 text-xs font-semibold tracking-wider uppercase text-[#e2e0f5]/80">
        Loading Technosavvys WMS...
      </p>
    </div>
  );
}
