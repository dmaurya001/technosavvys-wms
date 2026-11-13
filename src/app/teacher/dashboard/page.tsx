'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import AppHeader from '@/components/layout/AppHeader';
import { useApp } from '@/context/AppContext';
import InactivityTracker from '@/components/InactivityTracker';
import {
  QrCode,
  Calendar,
  Clock,
  Download,
  Upload,
  FileArchive,
  Users,
  CheckCircle2,
  Sparkles,
  Copy,
  ExternalLink,
  FileText,
  AlertTriangle,
  Award,
  RefreshCw,
  Plus,
  ShieldCheck,
  ChevronRight,
  LogOut,
  GraduationCap,
  Eye,
  Check,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Filter,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Settings,
  KeyRound,
  Trash2,
  X
} from 'lucide-react';
import { exportSessionAttendanceToExcel } from '@/lib/excelExport';
import { parseAndMatchFiles, parseAndMatchCertificateZip } from '@/lib/zipCertificateParser';
import { maskEmail, maskPhone, normalizeStudentName } from '@/lib/studentAuth';
import { getSessionPermanentQrToken } from '@/lib/qrSecurity';
import { createClient } from '@/lib/supabase/client';
import { BulkZipEntry, Workshop, WorkshopSession, AttendanceStatus, Student } from '@/types';
import { logAuditEvent } from '@/lib/audit';
import { NewWorkshopModal } from '@/components/modals/NewWorkshopModal';

export default function TeacherDashboardPage() {
  const router = useRouter();
  const {
    workshops,
    attendance,
    students,
    certificates,
    addWorkshop,
    updateWorkshop,
    deleteWorkshop,
    updateAttendanceStatus,
    syncAttendanceWithServer,
    toggleSessionActive,
    addToast,
  } = useApp();

  // --------------------------------------------------------------------------
  // SECTION 1: WORKSHOP STATE & PERMANENT SESSION QR CODE (STABLE PER SESSION)
  // --------------------------------------------------------------------------
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(workshops[0]?.id || '');
  const [workshopName, setWorkshopName] = useState(workshops[0]?.title || '');
  const [workshopDate, setWorkshopDate] = useState(workshops[0]?.date || new Date().toISOString().split('T')[0]);
  const [workshopTime, setWorkshopTime] = useState(workshops[0]?.time || '10:00 AM - 05:00 PM');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isNewWorkshopModalOpen, setIsNewWorkshopModalOpen] = useState(false);

  // Active Session & Permanent QR State
  const [activeSession, setActiveSession] = useState<WorkshopSession | null>(
    workshops[0]?.sessions?.[0] || null
  );
  const [qrToken, setQrToken] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Sync selected workshop details & resolve permanent session QR token
  useEffect(() => {
    const ws = workshops.find((w) => w.id === selectedWorkshopId);
    if (ws) {
      setWorkshopName(ws.title);
      setWorkshopDate(ws.date);
      setWorkshopTime(ws.time);
      if (ws.sessions && ws.sessions.length > 0) {
        const sess = ws.sessions[0];
        setActiveSession(sess);
        const permToken = sess.qrToken || getSessionPermanentQrToken(ws.id, sess.id);
        setQrToken(permToken);
      } else {
        setActiveSession(null);
        setQrToken('');
      }
    } else if (workshops.length > 0) {
      const first = workshops[0];
      setSelectedWorkshopId(first.id);
      setWorkshopName(first.title);
      setWorkshopDate(first.date);
      setWorkshopTime(first.time);
      if (first.sessions && first.sessions.length > 0) {
        setActiveSession(first.sessions[0]);
        setQrToken(first.sessions[0].qrToken || getSessionPermanentQrToken(first.id, first.sessions[0].id));
      }
    } else {
      setSelectedWorkshopId('');
      setWorkshopName('');
      setActiveSession(null);
      setQrToken('');
      setQrCodeDataUrl('');
    }
  }, [selectedWorkshopId, workshops]);

  // When active session or workshop changes, generate stable permanent QR data URL once
  useEffect(() => {
    if (activeSession && selectedWorkshopId && origin) {
      const permToken =
        activeSession.qrToken || getSessionPermanentQrToken(selectedWorkshopId, activeSession.id);
      setQrToken(permToken);

      const wsParam = encodeURIComponent(selectedWorkshopId);
      const titleParam = encodeURIComponent(workshopName || 'Workshop');
      const checkInUrl = `${origin}/attendance/${activeSession.id}?token=${permToken}&ws=${wsParam}&title=${titleParam}`;
      QRCode.toDataURL(checkInUrl, {
        width: 360,
        margin: 2,
        color: { dark: '#060f08', light: '#ffffff' },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [activeSession, selectedWorkshopId, origin, workshopName]);

  const [workshopToDelete, setWorkshopToDelete] = useState<Workshop | null>(null);
  const [isDeletingWorkshop, setIsDeletingWorkshop] = useState(false);

  const handleConfirmDeleteWorkshop = async () => {
    if (!workshopToDelete) return;
    try {
      setIsDeletingWorkshop(true);
      const res = await fetch(`/api/workshops?id=${encodeURIComponent(workshopToDelete.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete workshop');
      }

      deleteWorkshop(workshopToDelete.id);
      const remaining = workshops.filter((w) => w.id !== workshopToDelete.id);
      if (remaining.length > 0) {
        setSelectedWorkshopId(remaining[0].id);
      } else {
        setSelectedWorkshopId('');
        setWorkshopName('');
        setActiveSession(null);
        setQrToken('');
        setQrCodeDataUrl('');
      }
      addToast(`Workshop "${workshopToDelete.title}" and linked records safely deleted with backup.`, 'info');
      setWorkshopToDelete(null);
    } catch (err: any) {
      addToast(err.message || 'Error deleting workshop', 'error');
    } finally {
      setIsDeletingWorkshop(false);
    }
  };

  const isSessionActive = activeSession
    ? activeSession.isActive !== false &&
      activeSession.status !== 'Cancelled' &&
      activeSession.status !== 'Completed'
    : true;

  const handleToggleSessionStatus = () => {
    if (!activeSession) return;
    const newActiveState = toggleSessionActive(activeSession.id);
    setActiveSession((prev) =>
      prev
        ? {
            ...prev,
            isActive: newActiveState,
            status: (newActiveState ? 'Live' : 'Completed') as any,
          }
        : null
    );
  };

  const handleGenerateQr = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!workshopName.trim()) {
      addToast('Please enter a workshop title.', 'error');
      return;
    }

    let targetWorkshop = workshops.find((w) => w.id === selectedWorkshopId);
    const isDifferentTitle = targetWorkshop && targetWorkshop.title.trim().toLowerCase() !== workshopName.trim().toLowerCase();

    if (isCreatingNew || !targetWorkshop || isDifferentTitle) {
      const newWsId = `WS-${Date.now().toString().slice(-4)}`;
      const newSessionId = `SESS-${newWsId}-1`;
      const permanentSessionQrToken = getSessionPermanentQrToken(newWsId, newSessionId);

      const newSession: WorkshopSession = {
        id: newSessionId,
        workshopId: newWsId,
        sessionTitle: `${workshopName.trim()} - Main Session`,
        date: workshopDate,
        startTime: workshopTime.split('-')[0]?.trim() || '10:00 AM',
        endTime: workshopTime.split('-')[1]?.trim() || '05:00 PM',
        location: 'Campus / Virtual Lab',
        status: 'Scheduled',
        isActive: true,
        qrToken: permanentSessionQrToken,
      };

      addWorkshop({
        title: workshopName.trim(),
        category: 'Web Dev',
        trainer: 'Lead Instructor',
        trainerRole: 'Lead Instructor',
        date: workshopDate,
        time: workshopTime,
        duration: '6 Hours',
        location: 'Campus / Virtual Lab',
        capacity: 100,
        status: 'Ongoing',
        price: 0,
        description: 'Hands-on Workshop Session',
        tags: ['Workshop'],
        sessions: [newSession],
      });

      setSelectedWorkshopId(newWsId);
      setActiveSession(newSession);
      setQrToken(permanentSessionQrToken);
      setIsCreatingNew(false);
      addToast(`Workshop "${workshopName.trim()}" created with permanent QR!`, 'success');
    } else {
      updateWorkshop(targetWorkshop.id, {
        title: workshopName.trim(),
        date: workshopDate,
        time: workshopTime,
      });

      if (targetWorkshop.sessions && targetWorkshop.sessions.length > 0) {
        const sess = targetWorkshop.sessions[0];
        setActiveSession(sess);
        const permToken = sess.qrToken || getSessionPermanentQrToken(targetWorkshop.id, sess.id);
        setQrToken(permToken);
      }
      addToast(`QR Code session refreshed for "${workshopName.trim()}".`, 'success');
    }
  };

  const sessionCheckInUrl =
    activeSession && origin && qrToken
      ? `${origin}/attendance/${activeSession.id}?token=${qrToken}&ws=${encodeURIComponent(activeSession.workshopId || selectedWorkshopId)}&title=${encodeURIComponent(workshopName || 'Workshop')}`
      : '';

  const handleCopyLink = () => {
    if (sessionCheckInUrl) {
      navigator.clipboard.writeText(sessionCheckInUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      addToast('Permanent session check-in link copied to clipboard!', 'info');
    }
  };

  const handleDownloadQrImage = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `QR-${activeSession?.id || 'session'}-permanent.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --------------------------------------------------------------------------
  // SECTION 2: ATTENDANCE STATE, APPROVAL WORKFLOW & EXCEL
  // --------------------------------------------------------------------------
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);

  // Live Attendance Fetch from Server
  const fetchLiveAttendance = useCallback(async () => {
    try {
      setIsFetchingAttendance(true);
      const params = new URLSearchParams();
      if (selectedWorkshopId) params.set('workshopId', selectedWorkshopId);
      if (activeSession?.id) params.set('sessionId', activeSession.id);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.attendees)) {
          syncAttendanceWithServer(data.attendees);
        }
      }

      // Synchronize overall attendance records to guarantee full state continuity
      const allRes = await fetch('/api/attendance');
      if (allRes.ok) {
        const allData = await allRes.json();
        if (allData.success && Array.isArray(allData.attendees)) {
          syncAttendanceWithServer(allData.attendees);
        }
      }
    } catch (err) {
      console.warn('Error fetching live attendance:', err);
    } finally {
      setIsFetchingAttendance(false);
    }
  }, [selectedWorkshopId, activeSession?.id, syncAttendanceWithServer]);

  // Real-time polling: refresh every 3 seconds while on dashboard
  useEffect(() => {
    fetchLiveAttendance();
    const timer = setInterval(() => {
      fetchLiveAttendance();
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchLiveAttendance]);

  const registeredAttendees = attendance.filter((a) => {
    if (activeSession && a.sessionId === activeSession.id) return true;
    if (selectedWorkshopId) {
      if (a.workshopId === selectedWorkshopId) return true;
      if (a.sessionId && (a.sessionId === selectedWorkshopId || a.sessionId.includes(selectedWorkshopId))) return true;
      if (workshopName && a.workshopTitle && a.workshopTitle.trim().toLowerCase() === workshopName.trim().toLowerCase()) return true;
    }
    return false;
  });

  const pendingCount = registeredAttendees.filter(
    (a) => a.status === 'PENDING_REVIEW'
  ).length;

  const approvedCount = registeredAttendees.filter(
    (a) => a.status === 'APPROVED' || a.status === 'Present' || a.status === 'CERTIFICATE_ELIGIBLE'
  ).length;

  const rejectedCount = registeredAttendees.filter(
    (a) => a.status === 'REJECTED'
  ).length;

  const filteredAttendees = registeredAttendees.filter((a) => {
    if (attendanceFilter === 'PENDING') return a.status === 'PENDING_REVIEW';
    if (attendanceFilter === 'APPROVED')
      return a.status === 'APPROVED' || a.status === 'Present' || a.status === 'CERTIFICATE_ELIGIBLE';
    if (attendanceFilter === 'REJECTED') return a.status === 'REJECTED';
    return true;
  });

  const handleApproveAttendance = async (id: string, name: string) => {
    updateAttendanceStatus(id, 'APPROVED');
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'APPROVED' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (HTTP ${res.status})`);
      }
      addToast(`Approved attendance for ${name}. Student is now certificate-eligible!`, 'success');
      await fetchLiveAttendance();
    } catch (err: any) {
      console.error('Failed to sync approval with server:', err);
      addToast(`Failed to approve ${name}: ${err.message || 'Server error'}`, 'error');
      await fetchLiveAttendance();
    }
  };

  const handleRejectAttendance = async (id: string, name: string) => {
    updateAttendanceStatus(id, 'REJECTED');
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'REJECTED' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (HTTP ${res.status})`);
      }
      addToast(`Rejected attendance for ${name}.`, 'error');
      await fetchLiveAttendance();
    } catch (err: any) {
      console.error('Failed to sync rejection with server:', err);
      addToast(`Failed to reject ${name}: ${err.message || 'Server error'}`, 'error');
      await fetchLiveAttendance();
    }
  };

  const handleApproveAllPending = async () => {
    const pendingList = registeredAttendees.filter((a) => a.status === 'PENDING_REVIEW');
    if (pendingList.length === 0) {
      addToast('No pending attendance records to approve.', 'info');
      return;
    }
    const ids = pendingList.map((a) => a.id);
    pendingList.forEach((a) => updateAttendanceStatus(a.id, 'APPROVED'));
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: 'APPROVED' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (HTTP ${res.status})`);
      }
      addToast(`Approved ${pendingList.length} pending attendees!`, 'success');
      await fetchLiveAttendance();
    } catch (err: any) {
      console.error('Failed to sync bulk approval with server:', err);
      addToast(`Bulk approval failed: ${err.message || 'Server error'}`, 'error');
      await fetchLiveAttendance();
    }
  };

  const handleDownloadExcel = async () => {
    const ws = workshops.find((w) => w.id === selectedWorkshopId);
    if (!ws) {
      addToast('Please select a workshop first.', 'error');
      return;
    }

    const sessionToExport: WorkshopSession = activeSession || {
      id: `SESS-${ws.id}-1`,
      workshopId: ws.id,
      sessionTitle: `${ws.title} Session`,
      date: ws.date,
      startTime: '10:00 AM',
      endTime: '04:00 PM',
      location: ws.location,
      status: 'Completed',
    };

    try {
      await exportSessionAttendanceToExcel(ws, sessionToExport, attendance);
      addToast(`Downloaded formatted attendance Excel for ${ws.title}!`, 'success');
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      addToast(`Excel export failed: ${err.message}`, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // SECTION 3: CERTIFICATES STATE, MULTI-UPLOAD, DISAMBIGUATION & PUBLISH
  // --------------------------------------------------------------------------
  const [matchedEntries, setMatchedEntries] = useState<BulkZipEntry[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [certFilterTab, setCertFilterTab] = useState<'ALL' | 'matched' | 'suggested' | 'ambiguous' | 'unmatched' | 'failed'>('ALL');
  const [isPublishingCerts, setIsPublishingCerts] = useState(false);
  const [publishSuccessCount, setPublishSuccessCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<{ url: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Disambiguation Modal State
  const [disambiguateEntry, setDisambiguateEntry] = useState<BulkZipEntry | null>(null);
  const [disambiguateIndex, setDisambiguateIndex] = useState<number | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [adminOverrideConflict, setAdminOverrideConflict] = useState<boolean>(false);
  const [explicitConfirmation, setExplicitConfirmation] = useState<boolean>(false);

  // Clean eligible approved students computation strictly for the selected workshop (with fallback to global approved attendees)
  const eligibleApprovedStudents = useMemo(() => {
    const approvedAttendees = attendance.filter((a) => {
      const isApproved =
        a.status === 'APPROVED' ||
        a.status === 'Present' ||
        a.status === 'CERTIFICATE_ELIGIBLE';
      if (!isApproved) return false;
      if (activeSession && a.sessionId === activeSession.id) return true;
      if (selectedWorkshopId) {
        if (a.workshopId === selectedWorkshopId) return true;
        if (a.sessionId && (a.sessionId === selectedWorkshopId || a.sessionId.includes(selectedWorkshopId))) return true;
        if (workshopName && a.workshopTitle && a.workshopTitle.trim().toLowerCase() === workshopName.trim().toLowerCase()) return true;
      }
      return false;
    });

    const finalApprovedAttendees = approvedAttendees.length > 0
      ? approvedAttendees
      : attendance.filter((a) => a.status === 'APPROVED' || a.status === 'Present' || a.status === 'CERTIFICATE_ELIGIBLE');

    const studentMap = new Map<string, Student>();
    for (const att of finalApprovedAttendees) {
      const existing = students.find(
        (s) => (att.studentId && s.id === att.studentId) || (att.studentEmail && s.email.toLowerCase() === att.studentEmail.toLowerCase())
      );
      const studentId = att.studentId || att.id || (att.studentEmail ? `STU-${att.studentEmail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}` : `STU-${Date.now()}`);
      const stuObj: Student = existing ? { ...existing, id: existing.id || studentId } : {
        id: studentId,
        name: att.studentName,
        email: att.studentEmail,
        phone: att.studentPhone,
        college: att.studentCourse || 'Web Dev',
        batch: 'Batch 2026',
        regNo: att.studentRegNo || att.studentId || att.id || 'REG-PENDING',
        totalAttended: 1,
        enrolledWorkshopIds: [selectedWorkshopId || att.workshopId || 'WS-MAIN'],
        status: 'Active',
      };
      if (!studentMap.has(stuObj.id)) {
        studentMap.set(stuObj.id, stuObj);
      }
    }
    return Array.from(studentMap.values());
  }, [attendance, activeSession, selectedWorkshopId, workshopName, students]);

  const filesSummary = useMemo(() => {
    const total = matchedEntries.length;
    const matched = matchedEntries.filter((e) => e.status === 'matched').length;
    const suggested = matchedEntries.filter((e) => e.status === 'suggested').length;
    const ambiguous = matchedEntries.filter((e) => e.status === 'ambiguous').length;
    const unmatched = matchedEntries.filter((e) => e.status === 'unmatched').length;
    const failed = matchedEntries.filter((e) => e.status === 'failed' || e.status === 'duplicate').length;
    return { total, matched, suggested, ambiguous, unmatched, failed };
  }, [matchedEntries]);

  // Unified File Upload Handler (Handles Individual PDFs, Multi-PDFs, and ZIP archives)
  const handleFilesUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files || files.length === 0) return;

    setIsParsingFiles(true);
    setPublishSuccessCount(null);

    try {
      const candidateMap = new Map<string, Student>();
      for (const s of eligibleApprovedStudents) {
        candidateMap.set(s.id, s);
      }
      for (const s of students) {
        if (!candidateMap.has(s.id)) candidateMap.set(s.id, s);
      }
      const candidateStudents = Array.from(candidateMap.values());
      const enrolledIds = candidateStudents.map((s) => s.id);

      const res = await parseAndMatchFiles(
        files,
        candidateStudents,
        certificates,
        enrolledIds,
        matchedEntries
      );

      if (!res.success) {
        addToast(res.error || 'Failed to process files.', 'error');
        return;
      }

      setMatchedEntries(res.entries);
      addToast(
        `Processed ${res.totalFiles} certificates: ${res.matchedCount} matched, ${res.suggestedCount || 0} suggested, ${res.ambiguousCount} ambiguous, ${res.unmatchedCount} unmatched.`,
        'success'
      );
    } catch (err: any) {
      console.error('File parsing error:', err);
      addToast(`Error processing files: ${err.message}`, 'error');
    } finally {
      setIsParsingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveEntry = (id: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${fileName}" from the upload batch?`)) {
      return;
    }
    setMatchedEntries((prev) => prev.filter((e) => e.id !== id));
    addToast(`Removed "${fileName}" from batch.`, 'info');
  };

  const handleClearBatch = () => {
    if (matchedEntries.length === 0) return;
    if (!window.confirm(`Are you sure you want to clear all ${matchedEntries.length} files from this upload batch?`)) {
      return;
    }
    setMatchedEntries([]);
    setPublishSuccessCount(null);
    addToast('Cleared upload batch.', 'info');
  };

  const handleConfirmSuggestedMatch = (id: string) => {
    setMatchedEntries((prev) =>
      prev.map((e) => {
        if (e.id === id && e.suggestedStudentId) {
          return {
            ...e,
            matchedStudentId: e.suggestedStudentId,
            matchedStudentName: e.suggestedStudentName || null,
            status: 'matched',
            confidence: 0.95,
            manualMappingApproved: true,
            manualMappingApprovedBy: 'Lead Instructor (Confirmed Suggestion)',
            manualMappingApprovedAt: new Date().toISOString(),
          };
        }
        return e;
      })
    );
    addToast('Suggested match confirmed & approved!', 'success');
  };

  const openPreviewModal = (entry: BulkZipEntry) => {
    if (!entry.fileBlob) {
      addToast('Cannot preview: PDF file data not found.', 'error');
      return;
    }
    const url = URL.createObjectURL(entry.fileBlob);
    setPreviewPdfBlob({ url, fileName: entry.fileName });
  };

  const closePreviewModal = () => {
    if (previewPdfBlob?.url) {
      URL.revokeObjectURL(previewPdfBlob.url);
    }
    setPreviewPdfBlob(null);
  };

  // Check attendance approval status for a student
  const getStudentAttendanceStatus = (studentId: string, studentName?: string): AttendanceStatus | 'NOT_ATTENDED' => {
    const normName = studentName ? normalizeStudentName(studentName) : '';
    const record = attendance.find(
      (a) =>
        (a.workshopId === selectedWorkshopId || (activeSession && a.sessionId === activeSession.id)) &&
        (a.studentId === studentId || a.id === studentId || (normName && a.studentName && normalizeStudentName(a.studentName) === normName))
    ) || attendance.find((a) => a.studentId === studentId || a.id === studentId || (normName && a.studentName && normalizeStudentName(a.studentName) === normName));
    if (!record) return 'NOT_ATTENDED';
    return record.status;
  };

  // Check attendance eligibility before publishing
  const checkEligibility = (studentId?: string | null, studentName?: string | null): { eligible: boolean; reason: string } => {
    if (!studentId && !studentName) return { eligible: false, reason: 'Unmatched student' };

    const normName = studentName ? normalizeStudentName(studentName) : '';

    // Find matching candidate student
    const cand = eligibleApprovedStudents.find(
      (s) => (studentId && s.id === studentId) || (normName && normalizeStudentName(s.name) === normName)
    ) || students.find(
      (s) => (studentId && s.id === studentId) || (normName && normalizeStudentName(s.name) === normName)
    );

    const candEmail = cand?.email?.toLowerCase().trim();

    // 1. Try finding in current workshop/session attendance
    let attRecord = attendance.find((a) => {
      const inWorkshop =
        !selectedWorkshopId ||
        a.workshopId === selectedWorkshopId ||
        (activeSession && a.sessionId === activeSession.id) ||
        (a.sessionId && (a.sessionId === selectedWorkshopId || a.sessionId.includes(selectedWorkshopId))) ||
        (workshopName && a.workshopTitle && a.workshopTitle.trim().toLowerCase() === workshopName.trim().toLowerCase());

      if (!inWorkshop) return false;

      if (studentId && (a.studentId === studentId || a.id === studentId)) return true;
      if (cand && (a.studentId === cand.id || a.id === cand.id)) return true;
      if (candEmail && a.studentEmail && a.studentEmail.toLowerCase().trim() === candEmail) return true;
      if (normName && a.studentName) {
        const aNorm = normalizeStudentName(a.studentName);
        if (aNorm === normName || aNorm.includes(normName) || normName.includes(aNorm)) return true;
      }
      return false;
    });

    // 2. If not found in current workshop, check global attendance records
    if (!attRecord) {
      attRecord = attendance.find((a) => {
        if (studentId && (a.studentId === studentId || a.id === studentId)) return true;
        if (cand && (a.studentId === cand.id || a.id === cand.id)) return true;
        if (candEmail && a.studentEmail && a.studentEmail.toLowerCase().trim() === candEmail) return true;
        if (normName && a.studentName) {
          const aNorm = normalizeStudentName(a.studentName);
          if (aNorm === normName || aNorm.includes(normName) || normName.includes(aNorm)) return true;
        }
        return false;
      });
    }

    if (!attRecord) {
      return { eligible: false, reason: 'No attendance record found for this session' };
    }

    if (attRecord.status === 'PENDING_REVIEW') {
      return { eligible: false, reason: 'Attendance status is PENDING_REVIEW (Must be Approved)' };
    }

    if (attRecord.status === 'REJECTED') {
      return { eligible: false, reason: 'Attendance was REJECTED by instructor' };
    }

    if (
      attRecord.status === 'APPROVED' ||
      attRecord.status === 'Present' ||
      attRecord.status === 'CERTIFICATE_ELIGIBLE'
    ) {
      return { eligible: true, reason: 'Approved & Certificate Eligible' };
    }

    return { eligible: false, reason: `Status is ${attRecord.status}` };
  };

  // Open manual disambiguation modal
  const openDisambiguationModal = (entry: BulkZipEntry, index: number) => {
    setDisambiguateEntry(entry);
    setDisambiguateIndex(index);
    setSelectedCandidateId(null);
    setAdminOverrideConflict(false);
    setExplicitConfirmation(false);
  };

  // Close modal
  const closeDisambiguationModal = () => {
    setDisambiguateEntry(null);
    setDisambiguateIndex(null);
    setSelectedCandidateId(null);
    setAdminOverrideConflict(false);
    setExplicitConfirmation(false);
  };

  // Check if a candidate already has a conflicting certificate assigned
  const checkCandidateConflict = (candidateId: string): { conflict: boolean; reason?: string } => {
    const existingInZip = matchedEntries.find(
      (e, idx) => idx !== disambiguateIndex && e.matchedStudentId === candidateId
    );
    if (existingInZip) {
      return {
        conflict: true,
        reason: `Another PDF ("${existingInZip.fileName}") is already mapped to this student.`,
      };
    }

    const existingCert = certificates.find(
      (c) => c.studentId === candidateId && c.workshopId === selectedWorkshopId
    );
    if (existingCert) {
      return {
        conflict: true,
        reason: `Student already holds published certificate #${existingCert.certificateNo} for this workshop.`,
      };
    }

    return { conflict: false };
  };

  // Confirm manual mapping
  const handleConfirmManualMapping = async () => {
    if (disambiguateIndex === null || !disambiguateEntry || !selectedCandidateId) return;

    const candidate = eligibleApprovedStudents.find((s) => s.id === selectedCandidateId) ||
      students.find((s) => s.id === selectedCandidateId);
    if (!candidate) return;

    const conflictCheck = checkCandidateConflict(selectedCandidateId);
    if (conflictCheck.conflict && !adminOverrideConflict) {
      addToast('Conflict detected! You must check the Admin Override box to proceed.', 'error');
      return;
    }

    if (!explicitConfirmation) {
      addToast('Please confirm verification before saving manual mapping.', 'error');
      return;
    }

    // Update matchedEntries
    setMatchedEntries((prev) => {
      const copy = [...prev];
      copy[disambiguateIndex] = {
        ...copy[disambiguateIndex],
        matchedStudentId: candidate.id,
        matchedStudentName: candidate.name,
        status: 'matched',
        confidence: 1.0,
        manualMappingApproved: true,
        manualMappingApprovedBy: 'Lead Instructor (Manual Selection)',
        manualMappingApprovedAt: new Date().toISOString(),
      };
      return copy;
    });

    await logAuditEvent({
      action: 'MANUAL_CERTIFICATE_MAPPING_APPROVED',
      entityType: 'Certificate',
      entityId: candidate.id,
      details: {
        admin: 'Lead Instructor',
        fileName: disambiguateEntry.fileName,
        studentName: candidate.name,
        overrideApplied: adminOverrideConflict,
      },
    });

    addToast(`Successfully mapped "${disambiguateEntry.fileName}" to ${candidate.name}!`, 'success');
    closeDisambiguationModal();
  };

  const handlePublishCertificates = async () => {
    // Only publish entries that are matched AND whose attendance is APPROVED
    const eligibleEntries = matchedEntries.filter((entry) => {
      if (entry.status !== 'matched' || !entry.matchedStudentId) return false;
      const eligibility = checkEligibility(entry.matchedStudentId, entry.matchedStudentName);
      return eligibility.eligible;
    });

    if (eligibleEntries.length === 0) {
      addToast(
        'Cannot publish certificates: No matched student has APPROVED attendance. Please approve attendance in Section 2 first!',
        'error'
      );
      return;
    }

    setIsPublishingCerts(true);

    try {
      // Convert eligible blobs to Base64 payloads for secure server-side upload
      const certPayloads = await Promise.all(
        eligibleEntries.map(async (entry) => {
          const buffer = await entry.fileBlob.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');

          const normEntryName = entry.matchedStudentName ? normalizeStudentName(entry.matchedStudentName) : '';
          const matchedStu = eligibleApprovedStudents.find((s) => s.id === entry.matchedStudentId) ||
            students.find((s) => s.id === entry.matchedStudentId);

          const matchedAtt = attendance.find(
            (a) =>
              (entry.matchedStudentId && (a.studentId === entry.matchedStudentId || a.id === entry.matchedStudentId)) ||
              (matchedStu && matchedStu.email && a.studentEmail?.toLowerCase() === matchedStu.email.toLowerCase()) ||
              (normEntryName && a.studentName && normalizeStudentName(a.studentName) === normEntryName)
          );

          const resolvedEmail = matchedAtt?.studentEmail || matchedStu?.email || '';
          const resolvedPhone = matchedAtt?.studentPhone || matchedStu?.phone || '';
          const resolvedWorkshopId = matchedAtt?.workshopId || selectedWorkshopId;
          const resolvedWorkshopTitle = matchedAtt?.workshopTitle || workshopName || 'Workshop';

          return {
            fileName: entry.fileName,
            studentId: entry.matchedStudentId || matchedAtt?.studentId || matchedAtt?.id || 'STU-UNKNOWN',
            studentName: entry.matchedStudentName || matchedAtt?.studentName || matchedStu?.name || 'Student',
            studentEmail: resolvedEmail,
            studentPhone: resolvedPhone,
            workshopId: resolvedWorkshopId,
            workshopTitle: resolvedWorkshopTitle,
            attendanceApproved: true,
            fileBase64: base64,
          };
        })
      );

      const res = await fetch('/api/certificates/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: selectedWorkshopId,
          workshopTitle: workshopName || 'Workshop',
          certificates: certPayloads,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish certificates.');
      }

      const count = data.publishedCount || eligibleEntries.length;
      setPublishSuccessCount(count);
      addToast(`Successfully published ${count} certificates for approved students!`, 'success');

      // Remove published entries from matchedEntries batch
      setMatchedEntries((prev) => prev.filter((e) => !eligibleEntries.some((pub) => pub.id === e.id)));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Publishing error:', err);
      addToast(`Publishing failed: ${err.message}`, 'error');
    } finally {
      setIsPublishingCerts(false);
    }
  };

  // Admin Settings & Change Password Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordChangeStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordChangeStatus({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      setIsChangingPassword(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeStatus({
        type: 'error',
        text: 'New password must be at least 8 characters long.',
      });
      setIsChangingPassword(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setPasswordChangeStatus({
        type: 'success',
        text: 'Password updated successfully! Re-authenticating...',
      });

      setTimeout(() => {
        router.push('/teacher/login?message=password_updated');
      }, 1500);
    } catch (err: any) {
      setPasswordChangeStatus({
        type: 'error',
        text: err.message || 'Error updating administrator password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/teacher/login?message=logged_out');
  };

  return (
    <div className="tech-page-bg relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-40 -left-40 w-[700px] h-[700px] bg-emerald-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-40 -right-40 w-[700px] h-[700px] bg-teal-500/12" />
      <div className="ambient-glow top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/10" />

      {/* Official Branded Full-Width Header */}
      <AppHeader roleBadge="Teacher Console" badgeColor="gold">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setIsNewWorkshopModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5c542] hover:bg-[#e5b532] text-[#04201c] text-xs font-bold transition-all text-center cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">New Workshop</span>
          </button>
          <Link
            href="/certificates"
            target="_blank"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/20 text-xs font-semibold text-white transition-all text-center"
          >
            <Award className="w-3.5 h-3.5 shrink-0 text-[#2ee6a6]" />
            <span className="truncate">Public Portal</span>
          </Link>
          <button
            onClick={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordChangeStatus(null);
              setShowSettingsModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-[#f5c542]/20 border border-white/10 hover:border-[#f5c542]/40 text-xs font-semibold text-white transition-all text-center cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-[#f5c542] shrink-0" />
            <span className="truncate">Settings</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-semibold text-emerald-100 hover:text-rose-200 transition-all text-center cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </AppHeader>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-5 sm:py-8 relative z-10 space-y-6 sm:space-y-8">

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 1: WORKSHOP CREATION & DYNAMIC ROTATING QR (3D Glass Card) */}
        {/* ------------------------------------------------------------------ */}
        <section className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 border-emerald-500/30 shadow-glass space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glow-emerald">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Section 01
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Workshop &amp; Dynamic Rotating QR Code
                </h2>
              </div>
            </div>

            {/* Workshop Actions: Create New Workshop & Select/Delete Workshop */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewWorkshopModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-glow-emerald hover:brightness-110 hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-950" />
                <span>Create New Workshop</span>
              </button>

              {workshops.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  <select
                    value={selectedWorkshopId}
                    onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    className="glass-input text-xs rounded-full py-1.5 px-3 border-emerald-500/30 text-emerald-200 bg-emerald-950/80 max-w-[200px] sm:max-w-xs"
                  >
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id} className="bg-forest-950 text-white">
                        [{w.id}] {w.title.length > 28 ? w.title.substring(0, 28) + '...' : w.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const currentWs = workshops.find((w) => w.id === selectedWorkshopId);
                      if (currentWs) setWorkshopToDelete(currentWs);
                    }}
                    title="Delete currently selected workshop (Cascade with backup)"
                    className="p-1.5 sm:p-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {workshops.length === 0 ? (
            <div className="text-center py-10 space-y-4 rounded-2xl bg-white/[0.02] border border-white/5 p-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-glow-emerald">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">No Existing Workshops</h3>
                <p className="text-xs text-emerald-100/60 max-w-sm mx-auto font-light">
                  All existing workshops have been deleted. Click below to create your fresh workshop and generate its permanent attendance QR.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewWorkshopModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Create New Workshop</span>
              </button>
            </div>
          ) : (
            <>

          <form onSubmit={handleGenerateQr} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Field: Workshop Name */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Workshop Name / Title <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="e.g. Next.js 15 &amp; Modern Cloud Engineering"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 text-white font-medium"
              />
            </div>

            {/* Field: Date */}
            <div>
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Session Date <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                <input
                  type="date"
                  required
                  value={workshopDate}
                  onChange={(e) => setWorkshopDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 text-white font-mono"
                />
              </div>
            </div>

            {/* Field: Time */}
            <div>
              <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                Session Time <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
                <input
                  type="text"
                  required
                  value={workshopTime}
                  onChange={(e) => setWorkshopTime(e.target.value)}
                  placeholder="10:00 AM - 05:00 PM"
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 text-white"
                />
              </div>
            </div>

            {/* Action: Generate Dynamic QR Code */}
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:brightness-105 transition-all"
              >
                <QrCode className="w-4 h-4 text-slate-950" />
                <span>Generate Session QR</span>
              </button>
            </div>
          </form>

          {/* Permanent Unique Session QR Display Panel */}
          {activeSession && qrCodeDataUrl && (
            <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 w-full">
                <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0 relative mx-auto sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="Permanent Session QR Code"
                    className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                  />
                  <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-slate-900 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-400/40 shadow">
                    Static
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    {isSessionActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Session Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        Session Deactivated
                      </span>
                    )}
                    <span className="text-[10px] text-emerald-100/50">Unchanged for this session</span>
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-white break-words">
                    {workshopName}
                  </h4>
                  <p className="text-xs text-emerald-100/60 font-mono">
                    Session: {activeSession.id} • {workshopDate}
                  </p>
                  <p className="text-[11px] text-teal-300/80 font-mono break-all font-light max-w-md mx-auto sm:mx-0">
                    Target: /attendance/{activeSession.id}?token={qrToken.substring(0, 16)}...
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 w-full lg:w-48 shrink-0">
                {/* Admin Session Activation / Deactivation Toggle */}
                <button
                  type="button"
                  onClick={handleToggleSessionStatus}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all border min-h-[40px] ${
                    isSessionActive
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/40'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isSessionActive ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{isSessionActive ? 'Deactivate Session' : 'Activate Session'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-emerald-200 transition-all min-h-[40px]"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{copiedLink ? 'Copied Link' : 'Copy Active Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQrImage}
                  className="flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition-all min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Download QR PNG</span>
                </button>
                <Link
                  href={`/attendance/${activeSession.id}?token=${qrToken}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-xs font-semibold text-teal-300 transition-all min-h-[40px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">Open Test Scan</span>
                </Link>
              </div>
            </div>
          )}
          </>
        )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 2: ATTENDANCE & ADMIN APPROVAL WORKFLOW (3D Glass Card) */}
        {/* ------------------------------------------------------------------ */}
        <section className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 border-emerald-500/30 shadow-glass space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center shadow-glow-emerald">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Section 02
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Live Attendance &amp; Admin Approval
                </h2>
              </div>
            </div>

            {/* Counts & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleApproveAllPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve All Pending ({pendingCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchLiveAttendance()}
                disabled={isFetchingAttendance}
                className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/20 text-emerald-200 text-xs font-semibold transition-all disabled:opacity-50"
                title="Refresh live attendance from server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingAttendance ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                className="flex items-center gap-2 py-2 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-glow-emerald hover:-translate-y-0.5 hover:brightness-105 transition-all"
              >
                <Download className="w-4 h-4 text-slate-950" />
                <span>Download Excel</span>
              </button>
            </div>
          </div>

          {/* Filter Bar with Status Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3 text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAttendanceFilter('ALL')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all min-h-[36px] ${
                  attendanceFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'text-emerald-100/60 hover:text-white'
                }`}
              >
                All ({registeredAttendees.length})
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter('PENDING')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all min-h-[36px] ${
                  attendanceFilter === 'PENDING'
                    ? 'bg-amber-500/30 border border-amber-500/50 text-amber-200'
                    : 'text-amber-300/70 hover:text-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Pending ({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter('APPROVED')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all min-h-[36px] ${
                  attendanceFilter === 'APPROVED'
                    ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-200'
                    : 'text-emerald-300/70 hover:text-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Approved ({approvedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter('REJECTED')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all min-h-[36px] ${
                  attendanceFilter === 'REJECTED'
                    ? 'bg-rose-500/30 border border-rose-500/50 text-rose-200'
                    : 'text-rose-300/70 hover:text-rose-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Rejected ({rejectedCount})</span>
              </button>
            </div>

            <div className="text-[11px] text-emerald-100/50 hidden lg:block shrink-0">
              Rule: Only approved attendees can be issued certificates.
            </div>
          </div>

          {/* Registered Students Table or Empty State */}
          {filteredAttendees.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 text-emerald-400/60 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Attendees Found</h3>
              <p className="text-xs text-emerald-100/60 max-w-sm mx-auto font-light">
                {attendanceFilter === 'ALL'
                  ? 'No students have checked in for this session yet.'
                  : `No records matching filter "${attendanceFilter}".`}
              </p>
            </div>
          ) : (
            <div className="responsive-table-container border border-white/10 rounded-2xl">
              <table className="w-full text-left text-xs text-emerald-100/90 min-w-[640px]">
                <thead className="bg-emerald-950/80 text-[11px] font-bold uppercase tracking-wider text-emerald-300/80 border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Review Status</th>
                    <th className="py-3 px-4 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredAttendees.map((att) => {
                    const isApproved =
                      att.status === 'APPROVED' ||
                      att.status === 'Present' ||
                      att.status === 'CERTIFICATE_ELIGIBLE';
                    const isPending = att.status === 'PENDING_REVIEW';
                    const isRejected = att.status === 'REJECTED';

                    return (
                      <tr key={att.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {att.studentName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-200/80">
                          {att.studentEmail}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-teal-300">
                          {att.studentPhone}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-emerald-100/60">
                          {new Date(att.serverTimestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              PENDING_REVIEW
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              APPROVED (ELIGIBLE)
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              REJECTED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveAttendance(att.id, att.studentName)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectAttendance(att.id, att.studentName)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold transition-all"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <button
                                type="button"
                                onClick={() => handleRejectAttendance(att.id, att.studentName)}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-emerald-100/70 hover:text-rose-300 border border-white/10 text-[11px] font-semibold transition-all"
                              >
                                Revoke Approval
                              </button>
                            )}
                            {isRejected && (
                              <button
                                type="button"
                                onClick={() => handleApproveAttendance(att.id, att.studentName)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-all"
                              >
                                Re-Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 3: CERTIFICATES UPLOAD, DISAMBIGUATION & PUBLISHING        */}
        {/* ------------------------------------------------------------------ */}
        <section className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 border-emerald-500/30 shadow-glass space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glow-emerald">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Section 03
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Certificate Upload &amp; Verification
                </h2>
              </div>
            </div>

            {/* Action Buttons: Clear Batch & Publish */}
            <div className="flex items-center gap-2 flex-wrap">
              {matchedEntries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBatch}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Batch</span>
                </button>
              )}

              {filesSummary.matched > 0 && (
                <button
                  type="button"
                  onClick={handlePublishCertificates}
                  disabled={isPublishingCerts}
                  className="flex items-center gap-2 py-2 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-glow-emerald hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>{isPublishingCerts ? 'Publishing...' : `Publish Approved (${filesSummary.matched})`}</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Banner */}
          {publishSuccessCount !== null && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Successfully published <strong>{publishSuccessCount}</strong> verified certificates! Students can now verify and download them from <strong>/certificates</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Unified Drag-and-Drop / Multi-PDF / ZIP Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesUpload(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 group ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                : 'border-emerald-500/30 hover:border-emerald-400/60 bg-white/[0.02] hover:bg-white/[0.05]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.zip"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesUpload(e.target.files);
                }
              }}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isParsingFiles ? 'Processing & matching certificates...' : 'Drop PDF Certificates or ZIP Archive Here'}
              </p>
              <p className="text-xs text-emerald-100/60 font-light mt-1">
                Upload individual PDFs, select multiple PDFs at once, or upload a ZIP archive.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-emerald-200/70">
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10">.PDF (Individual / Multi)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10">.ZIP (Batch Archive)</span>
            </div>
          </div>

          {/* Pre-Publish Matching Report & Metrics Bar */}
          {matchedEntries.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                  <span className="block text-lg font-black text-white">{filesSummary.total}</span>
                  <span className="text-[10px] text-emerald-100/60 uppercase tracking-wider font-semibold">Total Uploaded</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="block text-lg font-black text-emerald-300">{filesSummary.matched}</span>
                  <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">Matched</span>
                </div>
                <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                  <span className="block text-lg font-black text-yellow-300">{filesSummary.suggested}</span>
                  <span className="text-[10px] text-yellow-300 uppercase tracking-wider font-semibold">Suggested Match</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="block text-lg font-black text-amber-300">{filesSummary.ambiguous}</span>
                  <span className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Ambiguous</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="block text-lg font-black text-rose-300">{filesSummary.unmatched}</span>
                  <span className="text-[10px] text-rose-300 uppercase tracking-wider font-semibold">Unmatched</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-500/20">
                  <span className="block text-lg font-black text-slate-300">{filesSummary.failed}</span>
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Failed</span>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap border-b border-white/[0.06] pb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setCertFilterTab('ALL')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    certFilterTab === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'text-emerald-100/60 hover:text-white'
                  }`}
                >
                  All ({filesSummary.total})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterTab('matched')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    certFilterTab === 'matched'
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                      : 'text-emerald-300/70 hover:text-emerald-200'
                  }`}
                >
                  Matched ({filesSummary.matched})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterTab('suggested')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    certFilterTab === 'suggested'
                      ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/40'
                      : 'text-yellow-300/70 hover:text-yellow-200'
                  }`}
                >
                  Suggested ({filesSummary.suggested})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterTab('ambiguous')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    certFilterTab === 'ambiguous'
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                      : 'text-amber-300/70 hover:text-amber-200'
                  }`}
                >
                  Ambiguous ({filesSummary.ambiguous})
                </button>
                <button
                  type="button"
                  onClick={() => setCertFilterTab('unmatched')}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    certFilterTab === 'unmatched'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'text-rose-300/70 hover:text-rose-200'
                  }`}
                >
                  Unmatched ({filesSummary.unmatched})
                </button>
                {filesSummary.failed > 0 && (
                  <button
                    type="button"
                    onClick={() => setCertFilterTab('failed')}
                    className={`px-3 py-1 rounded-full font-semibold transition-all ${
                      certFilterTab === 'failed'
                        ? 'bg-slate-500/30 text-slate-200 border border-slate-500/40'
                        : 'text-slate-300/70 hover:text-slate-200'
                    }`}
                  >
                    Failed ({filesSummary.failed})
                  </button>
                )}
              </div>

              {/* Uploaded Files Table List */}
              <div className="max-h-96 overflow-y-auto rounded-2xl border border-white/10 divide-y divide-white/[0.05]">
                {matchedEntries
                  .filter((entry) => {
                    if (certFilterTab === 'ALL') return true;
                    if (certFilterTab === 'failed') return entry.status === 'failed' || entry.status === 'duplicate';
                    return entry.status === certFilterTab;
                  })
                  .map((entry, idx) => {
                    const eligibility = checkEligibility(entry.matchedStudentId, entry.matchedStudentName);
                    const isMatched = entry.status === 'matched';
                    const isSuggested = entry.status === 'suggested';
                    const isAmbiguous = entry.status === 'ambiguous';
                    const isUnmatched = entry.status === 'unmatched';
                    const isFailed = entry.status === 'failed' || entry.status === 'duplicate';

                    return (
                      <div
                        key={entry.id || idx}
                        className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-white truncate max-w-xs">{entry.fileName}</span>
                              <span className="text-[10px] text-emerald-100/50">({(entry.fileSize / 1024).toFixed(1)} KB)</span>
                              {entry.manualMappingApproved && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                  Manual Verified
                                </span>
                              )}
                            </div>

                            {/* Status Sub-details */}
                            {isMatched && entry.matchedStudentName ? (
                              <p className="text-emerald-300/90 text-[11px] mt-0.5">
                                &rarr; Assigned: <strong>{entry.matchedStudentName}</strong>
                              </p>
                            ) : isSuggested && entry.suggestedStudentName ? (
                              <p className="text-yellow-300/90 text-[11px] mt-0.5 flex items-center gap-1.5">
                                <span>&rarr; Suggested Single Match: <strong>{entry.suggestedStudentName}</strong></span>
                              </p>
                            ) : isAmbiguous ? (
                              <p className="text-amber-300/90 text-[11px] mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{entry.errorMessage || 'Multiple matching students found. Manual review required.'}</span>
                              </p>
                            ) : isFailed ? (
                              <p className="text-rose-400 text-[11px] mt-0.5">
                                {entry.errorMessage || 'Invalid or duplicate file.'}
                              </p>
                            ) : (
                              <p className="text-rose-300/80 text-[11px] mt-0.5">
                                {entry.errorMessage || 'No eligible approved student matched this filename.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Badges & Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {/* Attendance Eligibility Badge for Matched */}
                          {isMatched && (
                            eligibility.eligible ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Attendance Approved
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {eligibility.reason}
                              </span>
                            )
                          )}

                          {/* Status Badge */}
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isMatched
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isSuggested
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : isAmbiguous
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {entry.status}
                          </span>

                          {/* Suggested Match: Quick Confirm Button */}
                          {isSuggested && (
                            <button
                              type="button"
                              onClick={() => handleConfirmSuggestedMatch(entry.id)}
                              className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                              title="Confirm suggested single match"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm Match</span>
                            </button>
                          )}

                          {/* Select Student Button for Ambiguous or Unmatched */}
                          {(isAmbiguous || isUnmatched) && (
                            <button
                              type="button"
                              onClick={() => openDisambiguationModal(entry, idx)}
                              className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Select Student</span>
                            </button>
                          )}

                          {/* Preview PDF Button */}
                          <button
                            type="button"
                            onClick={() => openPreviewModal(entry)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-emerald-200 border border-white/10 text-xs transition-colors cursor-pointer"
                            title="Preview PDF Certificate"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove File Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveEntry(entry.id, entry.fileName)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-rose-300 border border-white/10 text-xs transition-colors cursor-pointer"
                            title="Remove file from upload batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PDF PREVIEW MODAL                                                    */}
      {/* -------------------------------------------------------------------- */}
      {previewPdfBlob && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl max-w-4xl w-full p-5 border-emerald-500/30 shadow-2xl space-y-4 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white truncate max-w-md">
                  Preview: {previewPdfBlob.fileName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePreviewModal}
                className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-emerald-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 w-full h-[70vh] bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
              <object
                data={previewPdfBlob.url}
                type="application/pdf"
                className="w-full h-full"
              >
                <div className="p-8 text-center text-xs text-emerald-100/70 space-y-2">
                  <p>PDF preview is not supported by your browser viewer.</p>
                  <a
                    href={previewPdfBlob.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open PDF in New Window</span>
                  </a>
                </div>
              </object>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MANUAL DISAMBIGUATION MODAL (CLEAN SELECTION: APPROVED STUDENTS ONLY) */}
      {/* -------------------------------------------------------------------- */}
      {disambiguateEntry && disambiguateIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 xs:p-4 overflow-y-auto">
          <div className="glass-panel rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 border-teal-500/30 shadow-2xl space-y-4 sm:space-y-5 relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Strict Manual Student Selection
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5 break-words">
                  Assign Student to &quot;{disambiguateEntry.fileName}&quot;
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDisambiguationModal}
                className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-emerald-200 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verification Policy Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Identity Verification Policy:</strong> Only students belonging to this workshop with <strong>APPROVED</strong> attendance are eligible. Review masked credentials carefully before confirming mapping.
              </p>
            </div>

            {/* Eligible Approved Students Candidates List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <label className="block text-xs font-semibold text-emerald-100/80">
                Eligible Workshop Students ({eligibleApprovedStudents.length} approved attendees):
              </label>

              {eligibleApprovedStudents.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center text-xs text-amber-300">
                  No attendance-approved students found for this workshop session. Please approve student attendance in Section 2 first!
                </div>
              ) : (
                eligibleApprovedStudents.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id;
                  const conflict = checkCandidateConflict(cand.id);

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedCandidateId(cand.id)}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-teal-500/15 border-teal-400 shadow-glow-emerald'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{cand.name}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.08] text-teal-300">
                            ID: {cand.id} ({cand.regNo})
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            Attendance Approved
                          </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-emerald-100/60 font-mono flex-wrap">
                          <span>Email: {maskEmail(cand.email)}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Mobile: {maskPhone(cand.phone)}</span>
                        </div>

                        {conflict.conflict && (
                          <p className="text-[11px] text-amber-300 font-semibold mt-1">
                            ⚠ {conflict.reason}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center justify-end">
                        <input
                          type="radio"
                          name="selected_student_candidate"
                          checked={isSelected}
                          onChange={() => setSelectedCandidateId(cand.id)}
                          className="accent-teal-400 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Checkboxes for conflict override & explicit confirmation */}
            <div className="pt-2 border-t border-white/[0.08] space-y-2 text-xs">
              {selectedCandidateId && checkCandidateConflict(selectedCandidateId).conflict && (
                <label className="flex items-start gap-2 text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminOverrideConflict}
                    onChange={(e) => setAdminOverrideConflict(e.target.checked)}
                    className="mt-0.5 accent-amber-400 shrink-0"
                  />
                  <span>
                    <strong>Admin Override:</strong> I explicitly authorize issuing an additional certificate to this student for this workshop.
                  </span>
                </label>
              )}

              <label className="flex items-start gap-2 text-emerald-100/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={explicitConfirmation}
                  onChange={(e) => setExplicitConfirmation(e.target.checked)}
                  className="mt-0.5 accent-teal-400 shrink-0"
                />
                <span>
                  <strong>Explicit Confirmation:</strong> I verify that this certificate PDF belongs to the selected student and approve this mapping into the database.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={closeDisambiguationModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-emerald-200 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmManualMapping}
                disabled={
                  !selectedCandidateId ||
                  !explicitConfirmation ||
                  (checkCandidateConflict(selectedCandidateId).conflict && !adminOverrideConflict)
                }
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 text-xs font-bold shadow-glow-emerald disabled:opacity-40 transition-all text-center cursor-pointer"
              >
                Confirm Verified Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ADMIN SETTINGS & PASSWORD MANAGEMENT MODAL                         */}
      {/* ------------------------------------------------------------------ */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 xs:p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="card-3d-tilt glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full border border-emerald-500/30 space-y-4 sm:space-y-5 relative">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 p-2 text-emerald-100/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glow-emerald">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Admin Security Settings</h3>
                <p className="text-xs text-emerald-100/60">Change password &amp; manage credentials</p>
              </div>
            </div>

            {passwordChangeStatus && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                  passwordChangeStatus.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                {passwordChangeStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{passwordChangeStatus.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-100/80 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl glass-input placeholder-emerald-100/30 font-mono"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-emerald-200 text-xs font-semibold hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-60"
                >
                  {isChangingPassword ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW WORKSHOP CREATION MODAL */}
      <NewWorkshopModal
        isOpen={isNewWorkshopModalOpen}
        onClose={() => setIsNewWorkshopModalOpen(false)}
        onCreated={(newWs) => {
          setSelectedWorkshopId(newWs.id);
          setWorkshopName(newWs.title);
          setWorkshopDate(newWs.date);
          setWorkshopTime(newWs.time);
          if (newWs.sessions && newWs.sessions.length > 0) {
            setActiveSession(newWs.sessions[0]);
            setQrToken(newWs.sessions[0].qrToken || getSessionPermanentQrToken(newWs.id, newWs.sessions[0].id));
          }
          setIsNewWorkshopModalOpen(false);
        }}
      />

      {/* Workshop Safe Cascade Deletion Confirmation Modal */}
      {workshopToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Workshop Deletion</h3>
                <p className="text-xs text-slate-400">{workshopToDelete.title} ({workshopToDelete.id})</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/20 text-rose-200 text-xs leading-relaxed space-y-2">
              <p className="font-semibold">
                Deleting this workshop/session will also delete its linked attendance records and unpublished certificate records. This action cannot be undone. Continue?
              </p>
              <p className="text-[11px] text-slate-300">
                A recoverable backup will be created automatically before deletion. Published certificates are permanently protected and will not be deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWorkshopToDelete(null)}
                disabled={isDeletingWorkshop}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWorkshop}
                disabled={isDeletingWorkshop}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingWorkshop ? 'Deleting...' : 'Delete Workshop & Cascade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic 15-Minute Inactivity Tracker */}
      <InactivityTracker role="teacher" timeoutMinutes={15} />
    </div>
  );
}
