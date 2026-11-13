'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InactivityTracker from '@/components/InactivityTracker';
import {
  Award,
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User,
  GraduationCap,
  BookOpen,
  Phone,
  Mail,
  RefreshCw,
  FileText
} from 'lucide-react';

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  regNo: string;
  college: string;
  batch: string;
}

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

interface AttendanceLog {
  id: string;
  workshopTitle: string;
  sessionTitle: string;
  date: string;
  time: string;
  serverTimestamp: string;
  status: string;
  method?: string;
}

export default function StudentPortalPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);

  const [activeTab, setActiveTab] = useState<'certificates' | 'attendance'>('certificates');
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load student auth session from secure server endpoint
  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const reason = errData.reason || 'session_expired';
          router.push(`/student/login?error=${reason}`);
          return;
        }

        const data = await res.json();
        if (data.role !== 'student') {
          router.push('/student/login?error=unauthorized_student_resource');
          return;
        }

        if (data.student) {
          setStudent(data.student);
        }

        fetchStudentData();
      } catch (err) {
        router.push('/student/login?error=session_expired');
      }
    }

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchStudentData = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch issued certificates (browser sends HttpOnly cookie automatically)
      const certRes = await fetch('/api/portal/certificates');

      if (certRes.status === 401 || certRes.status === 403) {
        handleLogout();
        return;
      }

      if (certRes.ok) {
        const certData = await certRes.json();
        setCertificates(certData.certificates || []);
      }

      // 2. Fetch verified attendance history
      const attRes = await fetch('/api/portal/attendance');

      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendance(attData.attendance || []);
      }
    } catch (err: any) {
      setErrorMsg('Failed to synchronize student records. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  // Secure Certificate Download (60-second temporary signed URL)
  const handleDownload = async (cert: IssuedCertificate) => {
    setDownloadingId(cert.id);

    try {
      const res = await fetch('/api/portal/download-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ certificateId: cert.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate secure download link.');
      }

      // Trigger automatic download
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/student/login?message=logged_out');
  };

  return (
    <div className="min-h-screen bg-forest-950 text-emerald-50 relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-40 -left-40 w-[700px] h-[700px] bg-teal-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-40 -right-40 w-[700px] h-[700px] bg-emerald-500/12" />

      {/* Main Student Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Top Navbar */}
        <header className="glass-panel rounded-3xl p-4 sm:p-5 flex items-center justify-between border-emerald-500/25 shadow-glass">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-10 h-10 rounded-full bg-[#0a2318] border border-[#f5b335]/40 p-0.5 flex items-center justify-center shadow-glow-emerald shrink-0 hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Technosavvys Logo" className="w-full h-full object-contain rounded-full" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Technosavvys</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                  Student Portal
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/60 font-light">
                Verified Academic Credentials &amp; Attendance
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-semibold text-emerald-200 hover:text-rose-200 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Student Profile Card (3D Floating Glass) */}
        <section className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 border-teal-500/30 shadow-glass relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-glow-emerald shrink-0">
                {student?.name ? student.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Authenticated Student Identity</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {student?.name || 'Verified Student'}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-100/70 pt-0.5 font-light">
                  <span className="font-mono text-teal-300 font-medium">
                    Reg: {student?.regNo || 'REG-2026-STU'}
                  </span>
                  <span>{student?.college || 'Technosavvys Institute'}</span>
                  <span>Batch: {student?.batch || '2022-2026'}</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center min-w-[110px]">
                <span className="block text-xl sm:text-2xl font-black text-emerald-300">
                  {attendance.length}
                </span>
                <span className="text-[11px] text-emerald-100/60 uppercase tracking-wider font-semibold">
                  Attended
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center min-w-[110px]">
                <span className="block text-xl sm:text-2xl font-black text-teal-300">
                  {certificates.length}
                </span>
                <span className="text-[11px] text-teal-100/60 uppercase tracking-wider font-semibold">
                  Certificates
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('certificates')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'certificates'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-glow-emerald'
                  : 'bg-white/[0.06] text-emerald-200 hover:bg-white/[0.1]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Published Certificates ({certificates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'attendance'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-glow-emerald'
                  : 'bg-white/[0.06] text-emerald-200 hover:bg-white/[0.1]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Attendance History ({attendance.length})</span>
            </button>
          </div>

          <button
            onClick={() => fetchStudentData()}
            disabled={isLoading}
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-emerald-300 transition-colors"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* TAB 1: PUBLISHED CERTIFICATES */}
        {activeTab === 'certificates' && (
          <section className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-xs text-emerald-300 glass-panel rounded-3xl">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-400" />
                <span>Loading your verified certificates...</span>
              </div>
            ) : certificates.length === 0 ? (
              <div className="card-3d-tilt glass-panel rounded-[32px] p-10 text-center space-y-3 border-teal-500/20">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center mx-auto border border-teal-500/30">
                  <Award className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white">No Published Certificates Found</h3>
                <p className="text-xs text-emerald-100/60 max-w-sm mx-auto font-light">
                  Your instructor has not published certificates for your attended sessions yet. Once approved, they will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="card-3d-tilt glass-panel rounded-[28px] p-5 sm:p-6 border-teal-500/25 hover:border-teal-400/50 shadow-glass transition-all duration-300 flex flex-col justify-between group space-y-4 relative overflow-hidden"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-teal-300 font-bold px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30">
                          {cert.certificateNo}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {cert.grade || 'Pass'}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-white group-hover:text-teal-200 transition-colors">
                        {cert.workshopTitle}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-emerald-100/60 font-light">
                        <span>Instructor: {cert.trainer}</span>
                        <span>•</span>
                        <span>Issued: {cert.issueDate}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                        <span>Cryptographically Authenticated</span>
                      </div>

                      <button
                        onClick={() => handleDownload(cert)}
                        disabled={downloadingId === cert.id}
                        className="flex items-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs hover:shadow-glow-emerald transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-950" />
                        <span>{downloadingId === cert.id ? 'Securing URL...' : 'Download PDF'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: ATTENDANCE HISTORY */}
        {activeTab === 'attendance' && (
          <section className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-xs text-emerald-300 glass-panel rounded-3xl">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading your verified attendance logs...</span>
              </div>
            ) : attendance.length === 0 ? (
              <div className="card-3d-tilt glass-panel rounded-[32px] p-10 text-center space-y-3 border-emerald-500/20">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white">No Attendance Records Logged</h3>
                <p className="text-xs text-emerald-100/60 max-w-sm mx-auto font-light">
                  You have not registered attendance for any workshop sessions yet. Scan the session QR code during class to log attendance.
                </p>
              </div>
            ) : (
              <div className="card-3d-tilt glass-panel rounded-[32px] overflow-hidden border-emerald-500/25 shadow-glass">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-emerald-100/90">
                    <thead className="bg-emerald-950/80 text-[11px] font-bold uppercase tracking-wider text-emerald-300/80 border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3.5 px-5">Workshop Title</th>
                        <th className="py-3.5 px-5">Session</th>
                        <th className="py-3.5 px-5">Date</th>
                        <th className="py-3.5 px-5">Verification Method</th>
                        <th className="py-3.5 px-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {attendance.map((att) => (
                        <tr key={att.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-4 px-5 font-semibold text-white">
                            {att.workshopTitle}
                          </td>
                          <td className="py-4 px-5 text-emerald-100/70">
                            {att.sessionTitle}
                          </td>
                          <td className="py-4 px-5 font-mono text-emerald-200">
                            {att.date}
                          </td>
                          <td className="py-4 px-5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-teal-400" />
                              <span>{att.method || 'QR Scan Verified'}</span>
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase">
                              {att.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Automatic 15-Minute Inactivity Tracker */}
      <InactivityTracker role="student" timeoutMinutes={15} />
    </div>
  );
}

