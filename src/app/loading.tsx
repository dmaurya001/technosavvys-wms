import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#060f08] text-emerald-50 flex flex-col items-center justify-center p-6">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
      <p className="mt-4 text-xs font-semibold tracking-wider uppercase text-emerald-300/70">
        Loading Technosavvys WMS...
      </p>
    </div>
  );
}
