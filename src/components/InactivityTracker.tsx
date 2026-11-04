'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Clock, ShieldAlert } from 'lucide-react';

interface InactivityTrackerProps {
  role: 'teacher' | 'student';
  timeoutMinutes?: number; // Default 15 minutes
}

export default function InactivityTracker({
  role,
  timeoutMinutes = 15,
}: InactivityTrackerProps) {
  const router = useRouter();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = 60 * 1000; // Show warning 60 seconds before auto-logout
  const pingIntervalMs = 3 * 60 * 1000; // Keep-alive ping every 3 minutes

  const lastActivityRef = useRef<number>(Date.now());
  const lastPingRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  const performLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }

    const redirectLogin =
      role === 'teacher'
        ? '/teacher/login?error=session_idle_timeout'
        : '/student/login?error=session_idle_timeout';

    router.push(redirectLogin);
  }, [role, router]);

  const keepAlivePing = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/ping', { method: 'POST' });
      if (res.status === 401 || res.status === 403) {
        performLogout();
      }
    } catch {
      // Ignore background ping errors
    }
  }, [performLogout]);

  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    if (showWarning) {
      setShowWarning(false);
    }

    // If more than 3 minutes since last server touch, send keepalive
    if (now - lastPingRef.current > pingIntervalMs) {
      lastPingRef.current = now;
      keepAlivePing();
    }
  }, [showWarning, pingIntervalMs, keepAlivePing]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle activity handler to prevent excessive calls
    let lastHandled = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastHandled > 1000) {
        lastHandled = now;
        handleUserActivity();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, throttledHandler, { passive: true }));

    // Check timer interval every second
    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const timeLeft = timeoutMs - idleTime;

      if (timeLeft <= 0) {
        clearInterval(interval);
        performLogout();
      } else if (timeLeft <= warningMs) {
        setShowWarning(true);
        setSecondsRemaining(Math.ceil(timeLeft / 1000));
      } else if (showWarning) {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, throttledHandler));
      clearInterval(interval);
    };
  }, [timeoutMs, warningMs, showWarning, handleUserActivity, performLogout]);

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full p-4 rounded-2xl glass-panel border border-amber-500/40 bg-amber-950/80 text-amber-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Inactivity Notice
          </h4>
          <p className="text-xs text-amber-200/80 font-light">
            You will be automatically logged out in{' '}
            <span className="font-mono font-bold text-amber-300">{secondsRemaining}s</span> due to 15
            minutes of inactivity.
          </p>
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleUserActivity}
              className="px-3 py-1 text-[11px] font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
            >
              I&apos;m Still Here
            </button>
            <button
              type="button"
              onClick={performLogout}
              className="text-[11px] text-amber-300/70 hover:text-white transition-colors underline"
            >
              Sign Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
