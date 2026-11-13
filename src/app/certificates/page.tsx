'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Award,
  Sparkles,
  ShieldCheck,
  Mail,
  User,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Search,
  Calendar,
  ExternalLink,
  GraduationCap,
  Clock,
  LogOut,
  FileText
} from 'lucide-react';

interface IssuedCertificate {
  id: string;
  certificateNo: string;
  studentId: string;
  workshopTitle: string;
  trainer: string;
  issueDate: string;
  grade: 'Distinction' | 'Merit' | 'Pass';
  score?: number;
  status: string;
  storagePath?: string;
  fileName?: string;
}

function CertificatePortalContent() {
  // Step 1: Input (Name + Email) -> Step 2: Results (Instant without OTP)
  const [step, setStep] = useState<'input' | 'results'>('input');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authenticated student state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Direct Name + Email Find Certificate (NO OTP)
  const handleFindCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (!fullName.trim()) {
        throw new Error('Please enter your registered full name.');
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid registered email address.');
      }

      const res = await fetch('/api/portal/direct-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to find records. Please verify your name and email.');
      }

      setAuthToken(data.token);
      setStudentProfile(data.student);
      setCertificates(data.certificates || []);
      setStep('results');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error finding certificates.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Secure Certificate Download (60-second temporary signed URL)
  const handleDownload = async (cert: IssuedCertificate) => {
    if (!authToken) return;
    setDownloadingId(cert.id);

    try {
      const res = await fetch('/api/portal/download-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ certificateId: cert.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate secure download link.');
      }

      // Trigger automatic browser download
      const downloadLink = document.createElement('a');
      downloadLink.href = data.signedUrl;
      downloadLink.download = data.fileName || `${cert.certificateNo}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err: any) {
      alert(err.message || 'Download error. Please re-authenticate.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleReset = () => {
    setStep('input');
    setAuthToken(null);
    setCertificates([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-32 -left-32 w-[650px] h-[650px] bg-teal-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-32 -right-32 w-[600px] h-[600px] bg-emerald-500/12" />

      <div className="w-full max-w-xl relative z-10 space-y-6">
        {/* Technosavvys Branding Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-glow-emerald backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Technosavvys Public Credential Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Find &amp; Download Certificates
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/60 font-light max-w-md mx-auto">
            Official workshop certificate distribution. Enter your registered name and email to view and download authenticated digital credentials.
          </p>
        </div>

        {/* 3D Glassmorphism Portal Card */}
        <div className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 shadow-glass relative border-emerald-500/30">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: DIRECT NAME & EMAIL INPUT */}
          {step === 'input' && (
            <form onSubmit={handleFindCertificate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                    placeholder="e.g. Aditya Verma"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                  Registered Email Address <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                    placeholder="e.g. aditya.verma@technosavvys.edu"
                  />
                </div>
                <p className="text-[11px] text-emerald-100/40 mt-1">
                  Enter the email address registered during workshop attendance.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <Award className="w-4 h-4 text-slate-950" />
                  <span>{isLoading ? 'Searching Certificates...' : 'Find My Certificate'}</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>

              <div className="pt-2 border-t border-white/[0.06] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setFullName('Aditya Verma');
                    setEmail('aditya.verma@technosavvys.edu');
                  }}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                >
                  ⚡ Auto-fill registered student demo (Aditya Verma)
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: RESULTS - CERTIFICATE DISPLAY & DOWNLOAD */}
          {step === 'results' && (
            <div className="space-y-5 animate-fade-in">
              {/* Verified Identity Header */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-400">
                      Verified Student
                    </div>
                    <div className="text-sm font-bold text-white">
                      {studentProfile?.name || fullName}
                    </div>
                    <div className="text-xs text-emerald-100/50 font-mono">
                      {studentProfile?.email || email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-emerald-400/80 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/20 px-3 py-1.5 rounded-full hover:bg-emerald-500/10 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Search Another</span>
                </button>
              </div>

              {/* Certificates List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-100/80">
                  <span>Issued Certificates ({certificates.length})</span>
                  <span className="text-emerald-400 text-[11px]">100% Cryptographically Verified</span>
                </div>

                {certificates.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl bg-white/[0.02] border border-white/5 p-4 space-y-2">
                    <Award className="w-8 h-8 text-emerald-400/40 mx-auto" />
                    <div className="text-sm font-semibold text-white">No Published Certificates Yet</div>
                    <p className="text-xs text-emerald-100/60 max-w-sm mx-auto">
                      Your workshop attendance is verified. Once the instructor finalizes and publishes the certificates, they will appear here automatically.
                    </p>
                  </div>
                ) : (
                  certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                            {cert.certificateNo}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1.5 leading-snug">
                            {cert.workshopTitle}
                          </h4>
                          <div className="text-xs text-emerald-100/60 mt-0.5">
                            Trainer: {cert.trainer} • Issued: {cert.issueDate}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            cert.grade === 'Distinction'
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                              : cert.grade === 'Merit'
                              ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                              : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          {cert.grade || 'Certified'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-[11px] text-emerald-100/50 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tamper-Proof Document</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDownload(cert)}
                          disabled={downloadingId === cert.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-105 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {downloadingId === cert.id ? 'Generating...' : 'Download Certificate (PDF)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-center text-emerald-100/40 font-light">
          Technosavvys Academic Systems • Cryptographic Token Verification &amp; Private Storage
        </p>
      </div>
    </div>
  );
}

export default function CertificatePortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-forest-950 flex items-center justify-center text-xs text-emerald-400">
          Loading certificates...
        </div>
      }
    >
      <CertificatePortalContent />
    </Suspense>
  );
}
