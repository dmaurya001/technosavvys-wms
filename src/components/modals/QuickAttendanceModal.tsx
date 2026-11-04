'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApp } from '@/context/AppContext';
import { QrCode, CheckCircle2, UserCheck, Search, Sparkles, Clock } from 'lucide-react';
import { AttendanceStatus } from '@/types';

interface QuickAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickAttendanceModal: React.FC<QuickAttendanceModalProps> = ({ isOpen, onClose }) => {
  const { workshops, students, markAttendance } = useApp();
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(workshops[0]?.id || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<AttendanceStatus>('Present');
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const selectedWorkshop = workshops.find((w) => w.id === selectedWorkshopId);

  // Eligible students for this workshop
  const eligibleStudents = students.filter(
    (s) =>
      s.enrolledWorkshopIds.includes(selectedWorkshopId) &&
      (s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.regNo.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const handleScanStudent = (student: typeof students[0]) => {
    if (!selectedWorkshop) return;

    setIsScanning(true);
    setLastScanned(student.name);

    setTimeout(() => {
      const activeSession = selectedWorkshop.sessions && selectedWorkshop.sessions.length > 0
        ? selectedWorkshop.sessions[0]
        : null;

      markAttendance({
        workshopId: selectedWorkshop.id,
        workshopTitle: selectedWorkshop.title,
        sessionId: activeSession?.id || `${selectedWorkshop.id}-1`,
        sessionTitle: activeSession?.sessionTitle || 'Session 1: Main Workshop',
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        studentPhone: student.phone,
        studentCourse: student.batch,
        studentRegNo: student.regNo,
        date: activeSession?.date || new Date().toISOString().split('T')[0],
        status: scanStatus,
        checkInMethod: 'QR Scan',
      });
      setIsScanning(false);
    }, 600);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rapid Attendance Scanner"
      description="Live QR Code / RFID check-in terminal for workshop attendees."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Workshop selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Active Workshop Session
          </label>
          <select
            value={selectedWorkshopId}
            onChange={(e) => setSelectedWorkshopId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                [{w.id}] {w.title} ({w.status})
              </option>
            ))}
          </select>
        </div>

        {/* Viewfinder simulator */}
        <div className="relative rounded-2xl bg-slate-950 p-6 text-white overflow-hidden border border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />

          <div className="relative flex flex-col items-center justify-center py-6 text-center">
            {/* Viewfinder Frame */}
            <div className="relative w-44 h-44 rounded-2xl border-2 border-brand-500/80 flex items-center justify-center p-3 bg-brand-950/20 backdrop-blur-sm shadow-inner">
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-brand-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-brand-400" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-brand-400" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-brand-400" />

              {/* Laser line animated */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-bounce" />

              <QrCode className="w-24 h-24 text-slate-400 opacity-60" />
            </div>

            <p className="mt-4 text-xs font-medium text-slate-300">
              {isScanning ? (
                <span className="text-cyan-400 font-semibold animate-pulse">
                  Verifying credential for {lastScanned}...
                </span>
              ) : (
                'Scanner camera ready. Point attendee badge or click instant check-in below.'
              )}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Mark as:</span>
              {(['Present', 'Late', 'Excused'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setScanStatus(st)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    scanStatus === st
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Student Quick Select List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Registered Students ({eligibleStudents.length})
            </span>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by name/ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {eligibleStudents.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                No students enrolled in this workshop or none match the filter.
              </p>
            ) : (
              eligibleStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {student.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {student.regNo} • {student.college}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    icon={<UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
                    onClick={() => handleScanStudent(student)}
                    disabled={isScanning}
                  >
                    Simulate Scan
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

