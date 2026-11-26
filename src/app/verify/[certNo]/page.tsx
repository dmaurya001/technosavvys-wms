'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, XCircle, Search, Award, Calendar, User, BookOpen, ArrowLeft } from 'lucide-react';

interface VerifiedCert {
  certificateNo: string;
  studentName: string;
  workshopTitle: string;
  issueDate: string;
  trainer: string;
  grade: string;
  score: string | number;
  verificationCode: string;
  status: string;
}

export default function PublicVerifyCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const certNoParam = decodeURIComponent(String(params?.certNo || ''));

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [certificate, setCertificate] = useState<VerifiedCert | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lookupInput, setLookupInput] = useState(certNoParam);

  useEffect(() => {
    if (!certNoParam) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/certificates/verify?certNo=${encodeURIComponent(certNoParam)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.verified && data.certificate) {
          setVerified(true);
          setCertificate(data.certificate);
          setErrorMsg('');
        } else {
          setVerified(false);
          setCertificate(null);
          setErrorMsg(data.error || 'Certificate could not be verified.');
        }
      })
      .catch(() => {
        if (!active) return;
        setVerified(false);
        setErrorMsg('Unable to reach verification server.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [certNoParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = lookupInput.trim();
    if (!clean) return;
    router.push(`/verify/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen bg-[#241d63] text-white flex flex-col items-center justify-center p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-xl w-full space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f9b233] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Technosavvys Home
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#f9b233]">
            Official Credential Verification
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#f9b233]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter Certificate No or Verification Code..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#19134a]/80 border border-[#f9b233]/30 text-sm text-white placeholder:text-[#e2e0f5]/40 focus:outline-none focus:border-[#f9b233]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#f9b233] hover:brightness-110 text-[#19134a] text-xs font-bold transition-all cursor-pointer"
          >
            Verify
          </button>
        </form>

        <div className="rounded-3xl bg-[#19134a]/90 border border-[#f9b233]/35 p-6 sm:p-8 shadow-2xl">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
              <p className="text-xs text-emerald-200/70">Verifying credential...</p>
            </div>
          ) : verified && certificate ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                    Verified Authentic Credential
                  </span>
                  <h1 className="text-xl font-bold text-white mt-1">{certificate.studentName}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <BookOpen className="w-3.5 h-3.5" />
                    Workshop
                  </div>
                  <div className="font-semibold text-white text-sm">{certificate.workshopTitle}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <Award className="w-3.5 h-3.5" />
                    Certificate No
                  </div>
                  <div className="font-mono font-bold text-emerald-300 text-sm">{certificate.certificateNo}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <User className="w-3.5 h-3.5" />
                    Instructor
                  </div>
                  <div className="font-semibold text-white">{certificate.trainer}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <Calendar className="w-3.5 h-3.5" />
                    Issue Date &amp; Grade
                  </div>
                  <div className="font-semibold text-white">
                    {certificate.issueDate || 'Issued'} • {certificate.grade}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Verification Failed</h2>
              <p className="text-xs text-emerald-100/70">{errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
