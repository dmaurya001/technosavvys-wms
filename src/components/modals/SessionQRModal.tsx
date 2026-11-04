'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Workshop, WorkshopSession } from '@/types';
import {
  QrCode,
  Download,
  Copy,
  Printer,
  ExternalLink,
  Check,
  Calendar,
  Clock,
  MapPin,
  Sparkles
} from 'lucide-react';

interface SessionQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  workshop: Workshop | null;
  session: WorkshopSession | null;
}

export const SessionQRModal: React.FC<SessionQRModalProps> = ({
  isOpen,
  onClose,
  workshop,
  session,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const checkInUrl = session && origin ? `${origin}/checkin/${session.id}` : '';

  useEffect(() => {
    if (session && checkInUrl) {
      QRCode.toDataURL(checkInUrl, {
        width: 380,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [session, checkInUrl]);

  if (!workshop || !session) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `technosavvys-qr-${session.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Session Attendance QR Code"
      description="Scan to submit attendee credentials for this specific date & session."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Session details summary */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
              {workshop.title}
            </span>
            <Badge variant="primary" size="sm">{workshop.category}</Badge>
          </div>

          <p className="font-semibold text-brand-600 dark:text-brand-400">
            {session.sessionTitle}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-brand-500" />
              {session.date}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-brand-500" />
              {session.startTime} - {session.endTime}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-brand-500" />
              {session.location}
            </span>
          </div>
        </div>

        {/* QR Code Presentation Box */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* QR Container */}
          <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-brand-500/30">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for ${session.sessionTitle}`}
                className="w-56 h-56 rounded-xl object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                <span className="text-xs text-slate-400">Generating code...</span>
              </div>
            )}
          </div>

          <div className="mt-4 text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Check-In Active
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Point mobile camera to register attendance
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Session Token: {session.id}
            </p>
          </div>
        </div>

        {/* Link and Action Bar */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Direct Check-In Web Address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={checkInUrl}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono select-all focus:outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a href={checkInUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                  Open
                </Button>
              </a>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadQR}
                icon={<Download className="w-3.5 h-3.5 text-brand-500" />}
              >
                Download PNG
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                icon={<Printer className="w-3.5 h-3.5 text-slate-500" />}
              >
                Print Sheet
              </Button>
            </div>

            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

