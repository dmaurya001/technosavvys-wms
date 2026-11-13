'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Workshop, Student, AttendanceRecord, Certificate, AttendanceStatus, CertificateGrade, WorkshopSession } from '../types';
import { INITIAL_WORKSHOPS, INITIAL_STUDENTS, INITIAL_ATTENDANCE, INITIAL_CERTIFICATES } from '../data/mockData';
import { logAuditEvent } from '@/lib/audit';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface PublicCheckInPayload {
  sessionId: string;
  fullName: string;
  email: string;
  phone: string;
  course: string;
}

interface CheckInResult {
  success: boolean;
  message: string;
  record?: AttendanceRecord;
}

interface AppContextType {
  workshops: Workshop[];
  students: Student[];
  attendance: AttendanceRecord[];
  certificates: Certificate[];
  toasts: Toast[];
  darkMode: boolean;
  setDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleDarkMode: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Workshop operations
  addWorkshop: (workshop: Omit<Workshop, 'id' | 'enrolledCount' | 'sessions'> & { sessions?: WorkshopSession[] }) => Workshop;
  updateWorkshop: (id: string, updates: Partial<Workshop>) => void;
  deleteWorkshop: (id: string) => void;
  clearAllWorkshops: () => void;
  addSessionToWorkshop: (workshopId: string, sessionData: Omit<WorkshopSession, 'id' | 'workshopId'>) => WorkshopSession;
  getSessionById: (sessionId: string) => { session: WorkshopSession; workshop: Workshop } | undefined;
  toggleSessionActive: (sessionId: string) => boolean;

  // Student operations
  addStudent: (student: Omit<Student, 'id' | 'totalAttended'>) => void;
  enrollStudentInWorkshop: (studentId: string, workshopId: string) => void;

  // Attendance operations
  markAttendance: (record: Omit<AttendanceRecord, 'id' | 'time' | 'serverTimestamp'> & { time?: string; serverTimestamp?: string }) => void;
  updateAttendanceStatus: (id: string, status: AttendanceStatus) => void;
  bulkMarkAttendance: (workshopId: string, status: AttendanceStatus) => void;
  recordPublicCheckIn: (data: PublicCheckInPayload) => CheckInResult;
  syncAttendanceWithServer: (records: AttendanceRecord[]) => void;

  // Certificate operations
  issueCertificate: (studentId: string, workshopId: string, grade: CertificateGrade, score?: number) => Certificate;
  verifyCertificate: (certNo: string) => Certificate | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadWorkshops() {
      try {
        const res = await fetch('/api/workshops');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.workshops) && data.workshops.length > 0) {
            if (isMounted) {
              setWorkshops((prev) => {
                const map = new Map<string, Workshop>();
                for (const w of data.workshops) map.set(w.id, w);
                for (const w of prev) {
                  if (!map.has(w.id)) map.set(w.id, w);
                }
                const merged = Array.from(map.values());
                if (typeof window !== 'undefined') {
                  localStorage.setItem('technosavvys_workshops', JSON.stringify(merged));
                }
                return merged;
              });
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[AppContext] Failed to fetch workshops from server:', err);
      }

      // Fallback to local storage or INITIAL_WORKSHOPS
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('technosavvys_workshops');
          if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (isMounted) setWorkshops(parsed);
              return;
            }
          }
        }
      } catch {}

      if (isMounted) {
        setWorkshops(INITIAL_WORKSHOPS);
      }
    }

    loadWorkshops();
    return () => {
      isMounted = false;
    };
  }, []);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [certificates, setCertificates] = useState<Certificate[]>(INITIAL_CERTIFICATES);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Sync initial attendance from server on mount
  useEffect(() => {
    let isMounted = true;
    async function loadInitialAttendance() {
      try {
        const res = await fetch('/api/attendance');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.attendees) && isMounted) {
            setAttendance(data.attendees);
          }
        }
      } catch {}
    }
    loadInitialAttendance();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync dark class on html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addWorkshop = (workshopData: Omit<Workshop, 'id' | 'enrolledCount' | 'sessions'> & { sessions?: WorkshopSession[] }): Workshop => {
    const newId = `WS-${Date.now().toString().slice(-4)}`;
    
    // Default initial session if none provided
    const defaultSessions: WorkshopSession[] = workshopData.sessions && workshopData.sessions.length > 0
      ? workshopData.sessions
      : [
          {
            id: `SESS-${newId}-1`,
            workshopId: newId,
            sessionTitle: 'Session 1: Main Workshop',
            date: workshopData.date,
            startTime: workshopData.time.split('-')[0]?.trim() || '10:00 AM',
            endTime: workshopData.time.split('-')[1]?.trim() || '04:00 PM',
            location: workshopData.location,
            status: 'Scheduled',
          }
        ];

    const newWorkshop: Workshop = {
      ...workshopData,
      id: newId,
      enrolledCount: 0,
      sessions: defaultSessions,
    };

    setWorkshops((prev) => {
      const next = [newWorkshop, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem('technosavvys_workshops', JSON.stringify(next));
      }
      return next;
    });

    // Synchronize to Server and Supabase PostgreSQL
    fetch('/api/workshops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWorkshop),
    }).catch((err) => console.warn('[AppContext] Workshop sync warning:', err));

    addToast(`Workshop "${newWorkshop.title}" created with ${defaultSessions.length} session(s)!`, 'success');
    logAuditEvent({
      action: 'CREATE_WORKSHOP',
      entityType: 'Workshop',
      entityId: newId,
      details: { title: newWorkshop.title, category: newWorkshop.category, sessionsCount: defaultSessions.length },
    });
    return newWorkshop;
  };

  const updateWorkshop = (id: string, updates: Partial<Workshop>) => {
    let updatedObj: Workshop | undefined;
    setWorkshops((prev) => {
      const next = prev.map((ws) => {
        if (ws.id === id) {
          updatedObj = { ...ws, ...updates };
          return updatedObj;
        }
        return ws;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('technosavvys_workshops', JSON.stringify(next));
      }
      return next;
    });

    if (updatedObj) {
      fetch('/api/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedObj),
      }).catch((err) => console.warn('[AppContext] Workshop update warning:', err));
    }

    addToast('Workshop updated successfully.', 'info');
    logAuditEvent({
      action: 'UPDATE_WORKSHOP',
      entityType: 'Workshop',
      entityId: id,
      details: updates,
    });
  };

  const deleteWorkshop = (id: string) => {
    setWorkshops((prev) => {
      const next = prev.filter((ws) => ws.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('technosavvys_workshops', JSON.stringify(next));
      }
      return next;
    });

    fetch(`/api/workshops?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('[AppContext] Workshop delete warning:', err));

    addToast('Workshop deleted.', 'info');
    logAuditEvent({
      action: 'DELETE_WORKSHOP',
      entityType: 'Workshop',
      entityId: id,
    });
  };

  const clearAllWorkshops = () => {
    setWorkshops([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem('technosavvys_workshops', JSON.stringify([]));
    }

    fetch('/api/workshops?id=all', {
      method: 'DELETE',
    }).catch((err) => console.warn('[AppContext] Workshop clear warning:', err));

    addToast('All existing workshops deleted.', 'info');
    logAuditEvent({
      action: 'CLEAR_WORKSHOPS',
      entityType: 'Workshop',
      details: { timestamp: new Date().toISOString() },
    });
  };

  const addSessionToWorkshop = (workshopId: string, sessionData: Omit<WorkshopSession, 'id' | 'workshopId'>): WorkshopSession => {
    const workshop = workshops.find((w) => w.id === workshopId);
    const sessionIndex = (workshop?.sessions.length || 0) + 1;
    const newSessionId = `SESS-${workshopId}-${sessionIndex}`;

    const newSession: WorkshopSession = {
      ...sessionData,
      id: newSessionId,
      workshopId,
    };

    setWorkshops((prev) =>
      prev.map((w) =>
        w.id === workshopId
          ? { ...w, sessions: [...w.sessions, newSession] }
          : w
      )
    );

    addToast(`Session "${newSession.sessionTitle}" added to ${workshop?.title}!`, 'success');
    logAuditEvent({
      action: 'UPDATE_WORKSHOP',
      entityType: 'Workshop',
      entityId: workshopId,
      details: { newSessionId, sessionDate: newSession.date },
    });

    return newSession;
  };

  const getSessionById = (sessionId: string) => {
    for (const w of workshops) {
      const sess = w.sessions.find((s) => s.id === sessionId);
      if (sess) {
        return { session: sess, workshop: w };
      }
    }
    return undefined;
  };

  const toggleSessionActive = (sessionId: string): boolean => {
    let nowActive = true;
    setWorkshops((prev) =>
      prev.map((w) => {
        const hasSession = w.sessions?.some((s) => s.id === sessionId);
        if (!hasSession) return w;
        const updatedSessions = w.sessions.map((s) => {
          if (s.id === sessionId) {
            const currentActive = s.isActive !== false && s.status !== 'Cancelled' && s.status !== 'Completed';
            nowActive = !currentActive;
            return {
              ...s,
              isActive: nowActive,
              status: (nowActive ? 'Live' : 'Completed') as any,
            };
          }
          return s;
        });
        return { ...w, sessions: updatedSessions };
      })
    );
    addToast(
      nowActive
        ? 'Workshop session is now LIVE and accepting attendance.'
        : 'Workshop session DEACTIVATED. Attendance is closed.',
      'info'
    );
    return nowActive;
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'totalAttended'>) => {
    const newId = `STU-00${students.length + 1}`;
    const newStudent: Student = {
      ...studentData,
      id: newId,
      totalAttended: 0,
    };
    setStudents((prev) => [newStudent, ...prev]);
    addToast(`Student ${newStudent.name} registered successfully!`, 'success');
  };

  const enrollStudentInWorkshop = (studentId: string, workshopId: string) => {
    const student = students.find((s) => s.id === studentId);
    const workshop = workshops.find((w) => w.id === workshopId);
    if (!student || !workshop) return;

    if (student.enrolledWorkshopIds.includes(workshopId)) {
      addToast(`${student.name} is already enrolled in this workshop.`, 'info');
      return;
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, enrolledWorkshopIds: [...s.enrolledWorkshopIds, workshopId] }
          : s
      )
    );

    setWorkshops((prev) =>
      prev.map((w) =>
        w.id === workshopId ? { ...w, enrolledCount: w.enrolledCount + 1 } : w
      )
    );

    addToast(`${student.name} enrolled into ${workshop.title}`, 'success');
    logAuditEvent({
      action: 'ENROLL_STUDENT',
      entityType: 'Student',
      entityId: studentId,
      details: { studentName: student.name, workshopId, workshopTitle: workshop.title },
    });
  };

  const markAttendance = (
    record: Omit<AttendanceRecord, 'id' | 'time' | 'serverTimestamp'> & { time?: string; serverTimestamp?: string }
  ) => {
    // Check duplicate by sessionId + studentId/email on this date
    const existingIndex = attendance.findIndex(
      (a) =>
        a.sessionId === record.sessionId &&
        (a.studentId === record.studentId ||
         (a.studentEmail && record.studentEmail && a.studentEmail.toLowerCase() === record.studentEmail.toLowerCase()))
    );

    const currentTime = record.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentServerTimestamp = record.serverTimestamp || new Date().toISOString();

    if (existingIndex >= 0) {
      setAttendance((prev) => {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          status: record.status,
          checkInMethod: record.checkInMethod,
          time: currentTime,
          serverTimestamp: currentServerTimestamp,
          notes: record.notes,
        };
        return copy;
      });
      addToast(`Updated attendance for ${record.studentName}: ${record.status}`, 'info');
    } else {
      const newRecord: AttendanceRecord = {
        ...record,
        id: `ATT-${Date.now().toString().slice(-4)}`,
        time: currentTime,
        serverTimestamp: currentServerTimestamp,
      };
      setAttendance((prev) => [newRecord, ...prev]);

      if (record.status === 'Present' || record.status === 'Late') {
        if (record.studentId) {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === record.studentId ? { ...s, totalAttended: s.totalAttended + 1 } : s
            )
          );
        }
      }
      addToast(`Attendance marked: ${record.studentName} (${record.status})`, 'success');
    }

    logAuditEvent({
      action: 'MARK_ATTENDANCE',
      entityType: 'Attendance',
      entityId: record.studentId || record.studentEmail,
      details: { workshopId: record.workshopId, sessionId: record.sessionId, studentName: record.studentName, status: record.status },
    });
  };

  // Public QR Check-in Endpoint with Strict Duplicate Prevention
  const recordPublicCheckIn = (data: PublicCheckInPayload): CheckInResult => {
    const sessionLookup = getSessionById(data.sessionId);
    if (!sessionLookup) {
      return {
        success: false,
        message: 'Invalid Workshop Session: QR code is invalid or session was removed.',
      };
    }

    const { session, workshop } = sessionLookup;
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = data.phone.trim();
    const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');

    // Duplicate Prevention: Check if email or phone has already checked in for THIS session ID
    const duplicate = attendance.find(
      (a) =>
        a.sessionId === session.id &&
        (a.studentEmail.toLowerCase() === cleanEmail ||
         (cleanPhoneDigits.length > 5 && a.studentPhone.replace(/\D/g, '') === cleanPhoneDigits))
    );

    if (duplicate) {
      return {
        success: false,
        message: `Duplicate Entry Prevented: Attendance for "${data.fullName}" (${cleanEmail}) was already recorded for ${session.sessionTitle} on ${duplicate.date} at ${duplicate.time}.`,
        record: duplicate,
      };
    }

    // Server-Side Timestamp Verification
    const serverTimestamp = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Look up or auto-register student
    let student = students.find((s) => s.email.toLowerCase() === cleanEmail);
    if (!student) {
      student = {
        id: `STU-00${students.length + 1}`,
        name: data.fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        regNo: `TS-2026-${Math.floor(100 + Math.random() * 900)}`,
        college: 'Technosavvys Campus / Virtual',
        batch: data.course.trim(),
        enrolledWorkshopIds: [workshop.id],
        totalAttended: 1,
        status: 'Active',
      };
      setStudents((prev) => [student!, ...prev]);
      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === workshop.id ? { ...w, enrolledCount: w.enrolledCount + 1 } : w
        )
      );
    } else {
      if (!student.enrolledWorkshopIds.includes(workshop.id)) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student!.id
              ? {
                  ...s,
                  enrolledWorkshopIds: [...s.enrolledWorkshopIds, workshop.id],
                  totalAttended: s.totalAttended + 1,
                }
              : s
          )
        );
        setWorkshops((prev) =>
          prev.map((w) =>
            w.id === workshop.id ? { ...w, enrolledCount: w.enrolledCount + 1 } : w
          )
        );
      } else {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student!.id ? { ...s, totalAttended: s.totalAttended + 1 } : s
          )
        );
      }
    }

    // Create Verified Attendance Record
    const newRecord: AttendanceRecord = {
      id: `ATT-QR-${Date.now().toString().slice(-4)}`,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
      sessionId: session.id,
      sessionTitle: session.sessionTitle,
      studentId: student.id,
      studentName: data.fullName.trim(),
      studentEmail: cleanEmail,
      studentPhone: cleanPhone,
      studentCourse: data.course.trim(),
      studentRegNo: student.regNo,
      date: session.date, // Exact session date
      time: timeFormatted,
      serverTimestamp,
      status: 'PENDING_REVIEW', // Initial attendance status must be PENDING_REVIEW
      checkInMethod: 'QR Scan',
      notes: `Verified QR Scan check-in for session ${session.id}. Pending Admin Review.`,
    };

    setAttendance((prev) => [newRecord, ...prev]);

    logAuditEvent({
      action: 'MARK_ATTENDANCE',
      entityType: 'Attendance',
      entityId: student.id,
      details: {
        sessionId: session.id,
        sessionTitle: session.sessionTitle,
        studentName: newRecord.studentName,
        serverTimestamp,
        method: 'QR_Scan',
      },
    });

    addToast(`QR Check-in successful for ${newRecord.studentName}!`, 'success');

    return {
      success: true,
      message: `Verified! Attendance recorded for ${session.sessionTitle} on ${session.date} at ${timeFormatted}.`,
      record: newRecord,
    };
  };

  const updateAttendanceStatus = (id: string, status: AttendanceStatus) => {
    setAttendance((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    addToast(`Status updated to ${status}`, 'info');
  };

  const syncAttendanceWithServer = (serverRecords: AttendanceRecord[]) => {
    if (!Array.isArray(serverRecords)) return;
    setAttendance(() => serverRecords);
  };

  const bulkMarkAttendance = (workshopId: string, status: AttendanceStatus) => {
    const workshop = workshops.find((w) => w.id === workshopId);
    if (!workshop) return;

    const enrolledStudents = students.filter((s) =>
      s.enrolledWorkshopIds.includes(workshopId)
    );

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowServerTimestamp = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const defaultSession = workshop.sessions[0];

    setAttendance((prev) => {
      // Remove any current records for this workshop on today
      const otherRecords = prev.filter(
        (a) => !(a.workshopId === workshopId && a.date === today)
      );
      const newRecords: AttendanceRecord[] = enrolledStudents.map((s, idx) => ({
        id: `ATT-B${Date.now().toString().slice(-4)}-${idx}`,
        workshopId,
        workshopTitle: workshop.title,
        sessionId: defaultSession?.id || `${workshopId}-1`,
        sessionTitle: defaultSession?.sessionTitle || 'General Session',
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        studentPhone: s.phone,
        studentCourse: s.batch,
        studentRegNo: s.regNo,
        date: today,
        time: nowTime,
        serverTimestamp: nowServerTimestamp,
        status,
        checkInMethod: 'Manual',
      }));
      return [...newRecords, ...otherRecords];
    });

    addToast(`Bulk marked ${enrolledStudents.length} students as ${status}`, 'success');
  };

  const issueCertificate = (
    studentId: string,
    workshopId: string,
    grade: CertificateGrade = 'Distinction',
    score: number = 92
  ): Certificate => {
    const student = students.find((s) => s.id === studentId);
    const workshop = workshops.find((w) => w.id === workshopId);

    const certId = `CERT-${Date.now().toString().slice(-3)}`;
    const certNo = `TECH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCert: Certificate = {
      id: certId,
      certificateNo: certNo,
      studentId,
      studentName: student ? student.name : 'Participant',
      studentEmail: student ? student.email : '',
      workshopId,
      workshopTitle: workshop ? workshop.title : 'Workshop',
      trainer: workshop ? workshop.trainer : 'Technosavvys Instructor',
      issueDate: new Date().toISOString().split('T')[0],
      grade,
      status: 'Issued',
      score,
    };

    setCertificates((prev) => [newCert, ...prev]);
    addToast(`Certificate ${certNo} issued to ${newCert.studentName}!`, 'success');
    logAuditEvent({
      action: 'ISSUE_CERTIFICATE',
      entityType: 'Certificate',
      entityId: certNo,
      details: { studentId, studentName: newCert.studentName, workshopId, grade, score },
    });
    return newCert;
  };

  const verifyCertificate = (certNo: string) => {
    return certificates.find(
      (c) => c.certificateNo.trim().toUpperCase() === certNo.trim().toUpperCase()
    );
  };

  return (
    <AppContext.Provider
      value={{
        workshops,
        students,
        attendance,
        certificates,
        toasts,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        addToast,
        removeToast,
        addWorkshop,
        updateWorkshop,
        deleteWorkshop,
        clearAllWorkshops,
        addSessionToWorkshop,
        getSessionById,
        toggleSessionActive,
        addStudent,
        enrollStudentInWorkshop,
        markAttendance,
        updateAttendanceStatus,
        bulkMarkAttendance,
        recordPublicCheckIn,
        syncAttendanceWithServer,
        issueCertificate,
        verifyCertificate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
