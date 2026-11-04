'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
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
import { parseAndMatchCertificateZip } from '@/lib/zipCertificateParser';
import { maskEmail, maskPhone } from '@/lib/studentAuth';
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
    deleteWorkshop,
    clearAllWorkshops,
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

  const handleDeleteWorkshop = (id: string) => {
    if (!id) return;
    deleteWorkshop(id);
    const remaining = workshops.filter((w) => w.id !== id);
    if (remaining.length > 0) {
      setSelectedWorkshopId(remaining[0].id);
    } else {
      setSelectedWorkshopId('');
      setWorkshopName('');
      setActiveSession(null);
      setQrToken('');
      setQrCodeDataUrl('');
    }
  };

  const handleDeleteAllWorkshops = () => {
    if (workshops.length === 0) return;
    clearAllWorkshops();
    setSelectedWorkshopId('');
    setWorkshopName('');
    setActiveSession(null);
    setQrToken('');
    setQrCodeDataUrl('');
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

    let targetWorkshop = workshops.find((w) => w.id === selectedWorkshopId);

    if (isCreatingNew || !targetWorkshop) {
      const newWsId = `WS-${100 + workshops.length + 1}`;
      const newSessionId = `SESS-${100 + workshops.length + 1}-1`;
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
        description: 'Executive Hands-on Workshop',
        tags: ['Workshop'],
        sessions: [newSession],
      });

      setSelectedWorkshopId(newWsId);
      setActiveSession(newSession);
      setQrToken(permanentSessionQrToken);
      setIsCreatingNew(false);
      addToast(`Workshop "${workshopName}" created with permanent session QR!`, 'success');
    } else {
      if (targetWorkshop.sessions && targetWorkshop.sessions.length > 0) {
        const sess = targetWorkshop.sessions[0];
        setActiveSession(sess);
        const permToken = sess.qrToken || getSessionPermanentQrToken(targetWorkshop.id, sess.id);
        setQrToken(permToken);
      }
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
      if (a.sessionId && a.sessionId.includes(selectedWorkshopId)) return true;
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
    addToast(`Approved attendance for ${name}. Student is now certificate-eligible!`, 'success');
    try {
      await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'APPROVED' }),
      });
      fetchLiveAttendance();
    } catch (err) {
      console.error('Failed to sync approval with server:', err);
    }
  };

  const handleRejectAttendance = async (id: string, name: string) => {
    updateAttendanceStatus(id, 'REJECTED');
    addToast(`Rejected attendance for ${name}.`, 'error');
    try {
      await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'REJECTED' }),
      });
      fetchLiveAttendance();
    } catch (err) {
      console.error('Failed to sync rejection with server:', err);
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
    addToast(`Approved ${pendingList.length} pending attendees!`, 'success');
    try {
      await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: 'APPROVED' }),
      });
      fetchLiveAttendance();
    } catch (err) {
      console.error('Failed to sync bulk approval with server:', err);
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
  // SECTION 3: CERTIFICATES STATE, DISAMBIGUATION & PUBLISH
  // --------------------------------------------------------------------------
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [matchedEntries, setMatchedEntries] = useState<BulkZipEntry[]>([]);
  const [zipSummary, setZipSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    ambiguous: number;
  } | null>(null);
  const [isPublishingCerts, setIsPublishingCerts] = useState(false);
  const [publishSuccessCount, setPublishSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Disambiguation Modal State
  const [disambiguateEntry, setDisambiguateEntry] = useState<BulkZipEntry | null>(null);
  const [disambiguateIndex, setDisambiguateIndex] = useState<number | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [adminOverrideConflict, setAdminOverrideConflict] = useState<boolean>(false);
  const [explicitConfirmation, setExplicitConfirmation] = useState<boolean>(false);

  const handleZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      addToast('Please upload a valid .zip file containing student PDF certificates.', 'error');
      return;
    }

    setZipFile(file);
    setIsParsingZip(true);
    setPublishSuccessCount(null);

    try {
      const enrolledIds = students.map((s) => s.id);
      const res = await parseAndMatchCertificateZip(file, students, certificates, enrolledIds);

      if (!res.success) {
        addToast(res.error || 'Failed to parse ZIP archive', 'error');
        setZipFile(null);
        return;
      }

      setMatchedEntries(res.entries);
      setZipSummary({
        total: res.totalFiles,
        matched: res.matchedCount,
        unmatched: res.unmatchedCount,
        ambiguous: res.ambiguousCount,
      });

      addToast(
        `Extracted ${res.totalFiles} certificates: ${res.matchedCount} matched, ${res.ambiguousCount} ambiguous, ${res.unmatchedCount} unmatched.`,
        'success'
      );
    } catch (err: any) {
      console.error('ZIP Parsing error:', err);
      addToast(`Error processing ZIP: ${err.message}`, 'error');
    } finally {
      setIsParsingZip(false);
    }
  };

  // Check attendance approval status for a student
  const getStudentAttendanceStatus = (studentId: string): AttendanceStatus | 'NOT_ATTENDED' => {
    const record = attendance.find(
      (a) =>
        (a.workshopId === selectedWorkshopId || (activeSession && a.sessionId === activeSession.id)) &&
        a.studentId === studentId
    );
    if (!record) return 'NOT_ATTENDED';
    return record.status;
  };

  // Check attendance eligibility before publishing
  const checkEligibility = (studentId?: string | null): { eligible: boolean; reason: string } => {
    if (!studentId) return { eligible: false, reason: 'Unmatched student' };

    const attRecord = attendance.find(
      (a) =>
        (a.workshopId === selectedWorkshopId || (activeSession && a.sessionId === activeSession.id)) &&
        a.studentId === studentId
    );

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
    // Check if another entry in this ZIP is already mapped to candidate
    const existingInZip = matchedEntries.find(
      (e, idx) => idx !== disambiguateIndex && e.matchedStudentId === candidateId
    );
    if (existingInZip) {
      return {
        conflict: true,
        reason: `Another PDF ("${existingInZip.fileName}") is already mapped to this student.`,
      };
    }

    // Check if certificate already exists in DB for this workshop
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

    const candidate = students.find((s) => s.id === selectedCandidateId);
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
    const prevStatus = matchedEntries[disambiguateIndex].status;
    setMatchedEntries((prev) => {
      const copy = [...prev];
      copy[disambiguateIndex] = {
        ...copy[disambiguateIndex],
        matchedStudentId: candidate.id,
        matchedStudentName: candidate.name,
        status: 'matched',
        confidence: 1.0,
        manualMappingApproved: true,
        manualMappingApprovedBy: 'Lead Instructor',
        manualMappingApprovedAt: new Date().toISOString(),
      };
      return copy;
    });

    // Update zipSummary
    if (zipSummary && prevStatus !== 'matched') {
      setZipSummary({
        ...zipSummary,
        matched: zipSummary.matched + 1,
        ambiguous: prevStatus === 'ambiguous' ? Math.max(0, zipSummary.ambiguous - 1) : zipSummary.ambiguous,
        unmatched: prevStatus === 'unmatched' ? Math.max(0, zipSummary.unmatched - 1) : zipSummary.unmatched,
      });
    }

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
      const eligibility = checkEligibility(entry.matchedStudentId);
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
      const supabase = createClient();
      let publishedCount = 0;

      for (const entry of eligibleEntries) {
        const studentId = entry.matchedStudentId!;
        const storagePath = `certificates/${selectedWorkshopId}_${studentId}_${Date.now()}.pdf`;

        try {
          await supabase.storage
            .from('certificates')
            .upload(storagePath, entry.fileBlob, {
              contentType: 'application/pdf',
              upsert: true,
            });
        } catch {}

        const certNumber = `TECH-${new Date().getFullYear()}-${Math.floor(
          1000 + Math.random() * 9000
        )}`;
        const verificationHash = `${certNumber}_${studentId}_${Date.now()}`;

        try {
          await supabase.from('certificates').insert([
            {
              certificate_no: certNumber,
              student_id: studentId,
              workshop_id: selectedWorkshopId,
              trainer_name: 'Lead Instructor',
              issue_date: workshopDate || new Date().toISOString().split('T')[0],
              grade: 'Distinction',
              status: 'Issued',
              score: 95,
              verification_hash: verificationHash,
              storage_path: storagePath,
              file_name: entry.fileName,
              approved_by: entry.manualMappingApprovedBy || 'Lead Instructor',
            },
          ]);
        } catch {}

        publishedCount++;
      }

      await logAuditEvent({
        action: 'ISSUE_CERTIFICATE',
        entityType: 'Certificate',
        details: {
          workshopId: selectedWorkshopId,
          count: publishedCount,
        },
      });

      setPublishSuccessCount(publishedCount);
      addToast(`Successfully published ${publishedCount} certificates for approved students!`, 'success');

      setZipFile(null);
      setMatchedEntries([]);
      setZipSummary(null);
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
    <div className="min-h-screen bg-forest-950 text-emerald-50 relative overflow-hidden antialiased">
      {/* 3D Atmospheric Emerald Lighting Layers */}
      <div className="ambient-glow -top-40 -left-40 w-[700px] h-[700px] bg-emerald-500/15 animate-pulse-subtle" />
      <div className="ambient-glow -bottom-40 -right-40 w-[700px] h-[700px] bg-teal-500/12" />
      <div className="ambient-glow top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/10" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-5 sm:py-8 relative z-10 space-y-6 sm:space-y-8">
        {/* Navigation & Header */}
        <header className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-emerald-500/25 shadow-glass">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shadow-glow-emerald shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Technosavvys</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Teacher Console
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/60 font-light">
                Dynamic QR Attendance, Approval Workflow &amp; Strict Certificate Matching
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setIsNewWorkshopModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-200 transition-all text-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">New Workshop</span>
            </button>
            <Link
              href="/certificates"
              target="_blank"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-xs font-semibold text-teal-300 transition-all text-center"
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold text-emerald-200 transition-all text-center"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-semibold text-emerald-200 hover:text-rose-200 transition-all text-center"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

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
                    onClick={() => handleDeleteWorkshop(selectedWorkshopId)}
                    title="Delete currently selected workshop"
                    className="p-1.5 sm:p-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAllWorkshops}
                    title="Delete all existing workshops"
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 transition-all cursor-pointer"
                  >
                    Delete All
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
        {/* SECTION 3: ZIP CERTIFICATES UPLOAD + MATCH + PUBLISH (3D Glass Card) */}
        {/* ------------------------------------------------------------------ */}
        <section className="card-3d-tilt glass-panel rounded-[32px] p-6 sm:p-8 border-emerald-500/30 shadow-glass space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-glow-emerald">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Section 03
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Bulk ZIP Ingestion &amp; Strict Disambiguation
                </h2>
              </div>
            </div>

            {/* Explicit Publish Button */}
            {matchedEntries.length > 0 && (
              <button
                type="button"
                onClick={handlePublishCertificates}
                disabled={isPublishingCerts}
                className="flex items-center gap-2 py-2 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-glow-emerald hover:-translate-y-0.5 hover:brightness-105 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>{isPublishingCerts ? 'Publishing...' : 'Publish Approved Certificates'}</span>
              </button>
            )}
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

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-400/60 rounded-3xl p-8 text-center cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] transition-all space-y-3 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleZipFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isParsingZip ? 'Parsing and matching certificates...' : 'Upload Student Certificates ZIP'}
              </p>
              <p className="text-xs text-emerald-100/60 font-light mt-1">
                Drop your .zip file containing individual PDFs (e.g., Rahul_Kumar.pdf, krishna-verma.pdf).
              </p>
            </div>
            {zipFile && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
                <FileArchive className="w-3.5 h-3.5" />
                {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          {/* Pre-Publish Matching Report */}
          {matchedEntries.length > 0 && (
            <div className="space-y-4 pt-2">
              {zipSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="block text-lg font-black text-white">{zipSummary.total}</span>
                    <span className="text-[10px] text-emerald-100/60 uppercase tracking-wider">Total Files</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-lg font-black text-emerald-300">{zipSummary.matched}</span>
                    <span className="text-[10px] text-emerald-300 uppercase tracking-wider">Matched &amp; Ready</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <span className="block text-lg font-black text-amber-300">{zipSummary.ambiguous}</span>
                    <span className="text-[10px] text-amber-300 uppercase tracking-wider">Ambiguous (Needs Review)</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <span className="block text-lg font-black text-rose-300">{zipSummary.unmatched}</span>
                    <span className="text-[10px] text-rose-300 uppercase tracking-wider">Unmatched</span>
                  </div>
                </div>
              )}

              {/* Matched Preview List with Attendance Eligibility Check */}
              <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 divide-y divide-white/[0.05]">
                {matchedEntries.map((entry, idx) => {
                  const eligibility = checkEligibility(entry.matchedStudentId);
                  const isAmbiguous = entry.status === 'ambiguous';
                  const isUnmatched = entry.status === 'unmatched';
                  const isMatched = entry.status === 'matched';
                  const isDuplicate = entry.status === 'duplicate';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-white">{entry.fileName}</span>
                            {entry.manualMappingApproved && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                Manual Map Verified by {entry.manualMappingApprovedBy}
                              </span>
                            )}
                          </div>
                          {isMatched && entry.matchedStudentName ? (
                            <p className="text-emerald-300/90 text-[11px] mt-0.5">
                              &rarr; Assigned: <strong>{entry.matchedStudentName}</strong>
                            </p>
                          ) : isAmbiguous ? (
                            <p className="text-amber-300/90 text-[11px] mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>{entry.errorMessage || 'Duplicate student name detected. Manual review required.'}</span>
                            </p>
                          ) : (
                            <p className="text-rose-300/80 text-[11px] mt-0.5">
                              {entry.errorMessage || 'No registered student matched this filename.'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
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
                              : isAmbiguous
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isDuplicate
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {entry.status}
                        </span>

                        {/* Action: Open Disambiguation Modal for Ambiguous or Unmatched */}
                        {(isAmbiguous || isUnmatched) && (
                          <button
                            type="button"
                            onClick={() => openDisambiguationModal(entry, idx)}
                            className="px-3 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold transition-all flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Select Student</span>
                          </button>
                        )}
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
      {/* MANUAL DISAMBIGUATION MODAL FOR DUPLICATE / AMBIGUOUS NAMES */}
      {/* -------------------------------------------------------------------- */}
      {disambiguateEntry && disambiguateIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 xs:p-4 overflow-y-auto">
          <div className="glass-panel rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 border-teal-500/30 shadow-2xl space-y-4 sm:space-y-5 relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Strict Manual Disambiguation
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5 break-words">
                  Resolve Student for &quot;{disambiguateEntry.fileName}&quot;
                </h3>
              </div>
              <button
                onClick={closeDisambiguationModal}
                className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-emerald-200 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Identity Verification Policy:</strong> Name similarity alone is not sufficient to confirm student identity. Review masked credentials and attendance approval status carefully before selecting the recipient.
              </p>
            </div>

            {/* Candidates List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <label className="block text-xs font-semibold text-emerald-100/80">
                Matching Student Candidates ({disambiguateEntry.potentialMatches.length > 0 ? disambiguateEntry.potentialMatches.length : students.length} options):
              </label>

              {(disambiguateEntry.potentialMatches.length > 0
                ? disambiguateEntry.potentialMatches
                : students
              ).map((cand) => {
                const attStatus = getStudentAttendanceStatus(cand.id);
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

                    <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                      <div>
                        {attStatus === 'APPROVED' || attStatus === 'Present' || attStatus === 'CERTIFICATE_ELIGIBLE' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            Attendance Approved
                          </span>
                        ) : attStatus === 'PENDING_REVIEW' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            Pending Review
                          </span>
                        ) : attStatus === 'REJECTED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                            Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-emerald-100/40 text-[10px] font-bold">
                            No Attendance Record
                          </span>
                        )}
                      </div>

                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedCandidateId(cand.id)}
                        className="accent-teal-400 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
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
                className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-emerald-200 transition-colors text-center"
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
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 text-xs font-bold shadow-glow-emerald disabled:opacity-40 transition-all text-center"
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

      {/* Automatic 15-Minute Inactivity Tracker */}
      <InactivityTracker role="teacher" timeoutMinutes={15} />
    </div>
  );
}
