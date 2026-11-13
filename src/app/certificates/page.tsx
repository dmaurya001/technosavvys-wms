'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  Award,
  Sparkles,
  ShieldCheck,
  Phone,
  Mail,
  User,
  KeyRound,
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
  // Step 1: Input (Name + Email/Phone) -> Step 2: OTP -> Step 3: Results
  const [step, setStep] = useState<'input' | 'otp' | 'results'>('input');
  const [authMethod, setAuthMethod] = useState<'email' | 'mobile'>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Authenticated student state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Countdown timer for resending OTP
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (!fullName.trim()) {
        throw new Error('Please enter your registered full name.');
      }

      const payload: Record<string, string> = {
        fullName: fullName.trim(),
      };

      if (authMethod === 'email') {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Please enter a valid registered email address.');
        }
        payload.email = cleanEmail;
      } else {
        const cleanPhone = mobileNumber.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          throw new Error('Please enter a valid 10-digit registered mobile number.');
        }
        payload.mobileNumber = cleanPhone.slice(-10);
      }

      const res = await fetch('/api/portal/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP.');
      }

      setMaskedContact(data.maskedEmail || data.maskedPhone || (authMethod === 'email' ? email : mobileNumber));
      setStep('otp');
      setCountdown(45);
      if (data.devOtp || data.simulatedOtp) {
        setDevOtpHint(data.devOtp || data.simulatedOtp);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP & Find My Certificate
  const handleVerifyOtpAndFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const payload: Record<string, string> = {
        otp: otpCode.trim(),
      };

      if (authMethod === 'email') {
        payload.email = email.trim().toLowerCase();
      } else {
        payload.mobileNumber = mobileNumber.replace(/\D/g, '').slice(-10);
      }

      const res = await fetch('/api/portal/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }

      setAuthToken(data.token);
      setStudentProfile(data.student);

      // Fetch published certificates for this verified student
      const certRes = await fetch('/api/portal/certificates', {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      if (!certRes.ok) {
        const certErr = await certRes.json();
        throw new Error(certErr.error || 'Failed to retrieve certificates.');
      }

      const certData = await certRes.json();
      setCertificates(certData.certificates || []);
      setStep('results');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Secure Certificate Download (60-second temporary signed URL)
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
    setOtpCode('');
    setAuthToken(null);
    setCertificates([]);
    setErrorMsg(null);
    setDevOtpHint(null);
    setMaskedContact('');
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
            Official workshop certificate distribution. Verify your identity with OTP to download authenticated digital credentials.
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

          {devOtpHint && (
            <div className="mb-4 p-3 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between">
              <span className="font-light">Sandbox Verification Code:</span>
              <span className="font-mono font-bold text-sm bg-teal-950/80 px-2.5 py-0.5 rounded border border-teal-400/40 text-teal-200">
                {devOtpHint}
              </span>
            </div>
          )}

          {/* STEP 1: INPUT NAME & EMAIL (OR MOBILE) */}
          {step === 'input' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
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

              {authMethod === 'email' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-emerald-100/85">
                      Registered Email Address <span className="text-emerald-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('mobile')}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                    >
                      Use Mobile Number instead
                    </button>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30"
                      placeholder="e.g. aditya.verma@technosavvys.edu"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-100/40 mt-1">
                    We will send a 6-digit OTP code to your registered email to verify student identity.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-emerald-100/85">
                      Registered Mobile Number <span className="text-emerald-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('email')}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                    >
                      Use Email Address instead
                    </button>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                      placeholder="9876543210"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-100/40 mt-1">
                    We will send a 6-digit OTP code to verify student identity.
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-slate-950" />
                  <span>{isLoading ? 'Sending OTP Code...' : 'Send OTP'}</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>

              <div className="pt-2 border-t border-white/[0.06] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setFullName('Aditya Verma');
                    setAuthMethod('email');
                    setEmail('aditya.verma@technosavvys.edu');
                  }}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                >
                  ⚡ Auto-fill registered student demo (Aditya Verma)
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY OTP & FIND MY CERTIFICATE */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtpAndFind} className="space-y-4">
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-emerald-100/80 flex items-center justify-between">
                <div>
                  <span className="text-emerald-100/50 block text-[10px]">VERIFYING STUDENT:</span>
                  <span className="font-semibold text-white">{fullName}</span>
                  <span className="font-mono text-teal-300 ml-2">
                    ({maskedContact || (authMethod === 'email' ? email : mobileNumber)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100/85 mb-1.5">
                  Enter 6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-4 py-2.5 text-center tracking-widest text-base sm:text-lg rounded-2xl glass-input font-mono font-bold placeholder-emerald-100/30"
                    placeholder="123456"
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-60"
                >
                  <Search className="w-4 h-4 text-slate-950" />
                  <span>{isLoading ? 'Verifying & Searching...' : 'Find My Certificate'}</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-emerald-100/50 pt-1">
                <span>Didn&apos;t receive code?</span>
                {countdown > 0 ? (
                  <span>Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-teal-400 hover:text-teal-300 font-semibold"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: RESULTS & CERTIFICATE DOWNLOAD */}
          {step === 'results' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Verified Student
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {studentProfile?.name || fullName}
                  </h3>
                </div>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-emerald-200"
                >
                  Search Again
                </button>
              </div>

              {certificates.length === 0 ? (
                /* Required Unpublished Error Message */
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto">
                    <Clock className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Certificate Not Available
                  </h4>
                  <p className="text-xs text-amber-200/90 max-w-md mx-auto leading-relaxed font-light">
                    Your certificate is not available yet. Please contact your workshop administrator.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-5 rounded-2xl bg-white/[0.04] border border-emerald-500/30 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] text-teal-300 font-bold px-2 py-0.5 rounded bg-teal-500/20">
                            {cert.certificateNo}
                          </span>
                          <h4 className="text-base font-bold text-white mt-1">
                            {cert.workshopTitle}
                          </h4>
                          <p className="text-xs text-emerald-100/60 font-light mt-0.5">
                            Trainer: {cert.trainer} • Issued: {cert.issueDate}
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {cert.grade || 'Pass'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>60-second secure temporary download</span>
                        </div>

                        <button
                          onClick={() => handleDownload(cert)}
                          disabled={downloadingId === cert.id}
                          className="flex items-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs hover:shadow-glow-emerald hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-950" />
                          <span>{downloadingId === cert.id ? 'Securing Link...' : 'Download Certificate PDF'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-center text-emerald-100/40 font-light">
          Technosavvys Academic Systems • Cryptographic Token Verification &amp; Private Storage
        </p>
      </div>
    </div>
  );
}

export default function PublicCertificatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-forest-950 flex items-center justify-center text-xs text-emerald-400">Loading certificate gateway...</div>}>
      <CertificatePortalContent />
    </Suspense>
  );
}
