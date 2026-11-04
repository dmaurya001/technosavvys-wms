'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { AttendanceStatus } from '@/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { QuickAttendanceModal } from '@/components/modals/QuickAttendanceModal';
import {
  exportAllAttendanceToExcel,
  exportWorkshopAttendanceToExcel,
  exportSessionAttendanceToExcel,
} from '@/lib/excelExport';
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  QrCode,
  Download,
  Filter,
  CheckCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';

function AttendanceContent() {
  const {
    workshops,
    students,
    attendance,
    markAttendance,
    updateAttendanceStatus,
    bulkMarkAttendance,
    addToast
  } = useApp();

  const searchParams = useSearchParams();
  const queryWorkshopId = searchParams.get('workshopId');

  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(queryWorkshopId || 'all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Available dates across records
  const distinctDates = useMemo(() => {
    return Array.from(new Set(attendance.map((a) => a.date))).sort().reverse();
  }, [attendance]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return attendance.filter((rec) => {
      const matchWorkshop =
        selectedWorkshopId === 'all' || rec.workshopId === selectedWorkshopId;
      const matchDate =
        selectedDateFilter === 'all' || rec.date === selectedDateFilter;
      const matchStatus =
        selectedStatus === 'all' || rec.status === selectedStatus;
      const matchSearch =
        rec.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (rec.studentEmail && rec.studentEmail.toLowerCase().includes(search.toLowerCase())) ||
        (rec.studentPhone && rec.studentPhone.includes(search)) ||
        (rec.studentCourse && rec.studentCourse.toLowerCase().includes(search.toLowerCase())) ||
        (rec.studentRegNo && rec.studentRegNo.toLowerCase().includes(search.toLowerCase())) ||
        rec.workshopTitle.toLowerCase().includes(search.toLowerCase());

      return matchWorkshop && matchDate && matchStatus && matchSearch;
    });
  }, [attendance, selectedWorkshopId, selectedDateFilter, selectedStatus, search]);

  // Telemetry numbers
  const currentWorkshopRecords = selectedWorkshopId === 'all'
    ? attendance
    : attendance.filter((a) => a.workshopId === selectedWorkshopId);

  const presentCount = currentWorkshopRecords.filter((a) => a.status === 'Present').length;
  const lateCount = currentWorkshopRecords.filter((a) => a.status === 'Late').length;
  const absentCount = currentWorkshopRecords.filter((a) => a.status === 'Absent').length;
  const excusedCount = currentWorkshopRecords.filter((a) => a.status === 'Excused').length;
  const totalCount = currentWorkshopRecords.length;

  const attendancePct = totalCount > 0
    ? Math.round(((presentCount + lateCount) / totalCount) * 100)
    : 0;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      addToast('No records to export', 'info');
      return;
    }

    const headers = ['Record ID', 'Workshop ID', 'Workshop Title', 'Student Name', 'Reg No', 'Date', 'Time', 'Status', 'Check-In Method'];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.workshopId,
      `"${r.workshopTitle.replace(/"/g, '""')}"`,
      `"${r.studentName}"`,
      r.studentRegNo,
      r.date,
      r.time,
      r.status,
      r.checkInMethod
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `technosavvys-attendance-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Attendance CSV downloaded successfully!', 'success');
  };

  // Export to Formatted XLSX
  const handleExportXLSX = async () => {
    if (filteredRecords.length === 0) {
      addToast('No records to export', 'info');
      return;
    }
    try {
      if (selectedWorkshopId !== 'all') {
        const targetWs = workshops.find((w) => w.id === selectedWorkshopId);
        if (targetWs) {
          if (selectedDateFilter !== 'all') {
            const targetSess = targetWs.sessions.find((s) => s.date === selectedDateFilter);
            if (targetSess) {
              await exportSessionAttendanceToExcel(targetWs, targetSess, attendance);
              addToast(`Exported session XLSX for ${targetSess.sessionTitle}`, 'success');
              return;
            }
          }
          await exportWorkshopAttendanceToExcel(targetWs, attendance);
          addToast(`Exported workshop XLSX for ${targetWs.title}`, 'success');
          return;
        }
      }
      await exportAllAttendanceToExcel(workshops, filteredRecords);
      addToast('Master attendance XLSX exported successfully!', 'success');
    } catch (err: any) {
      addToast('Excel export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Attendance Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time biometric, RFID, QR scan and manual session verification logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
            onClick={handleExportXLSX}
          >
            Export XLSX
          </Button>

          <Button
            variant="outline"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={<QrCode className="w-4 h-4" />}
            onClick={() => setIsScannerOpen(true)}
          >
            Launch QR Scanner
          </Button>
        </div>
      </div>

      {/* Workshop Filter & Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Total Logs</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{totalCount}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Present</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{presentCount}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">Late</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lateCount}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">Absent</p>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{absentCount}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-purple-600 dark:text-purple-400">Excused</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{excusedCount}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase opacity-80">Turnout Rate</p>
          <p className="text-xl font-bold mt-0.5">{attendancePct}%</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Workshop selector */}
          <div className="flex-1 max-w-xs">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Workshop
            </label>
            <select
              value={selectedWorkshopId}
              onChange={(e) => setSelectedWorkshopId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Workshop Tracks</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.id}] {w.title}
                </option>
              ))}
            </select>
          </div>

          {/* Session Date filter */}
          <div className="shrink-0 min-w-[140px]">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Session Date
            </label>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Session Dates</option>
              {distinctDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Search Attendees
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search attendee by name, reg number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Status selector */}
          <div className="shrink-0">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Status Filter
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {['all', 'Present', 'Absent', 'Late', 'Excused'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                    selectedStatus === st
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedWorkshopId !== 'all' && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Bulk actions for selected workshop:
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                onClick={() => bulkMarkAttendance(selectedWorkshopId, 'Present')}
              >
                Mark All Enrolled Present
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkMarkAttendance(selectedWorkshopId, 'Absent')}
              >
                Reset All to Absent
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Attendance Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Attendee Credentials</th>
                <th className="py-3.5 px-4">Workshop & Session</th>
                <th className="py-3.5 px-4">Session Date & Time</th>
                <th className="py-3.5 px-4">Method & Server Stamp</th>
                <th className="py-3.5 px-4">Status & Quick Toggle</th>
                <th className="py-3.5 px-4 text-right">Record ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No attendance records match your current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isPresent = record.status === 'Present';
                  const isLate = record.status === 'Late';
                  const isAbsent = record.status === 'Absent';
                  const isExcused = record.status === 'Excused';

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Student info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {record.studentName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {record.studentName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {record.studentEmail} • {record.studentPhone}
                            </p>
                            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-medium mt-0.5">
                              {record.studentCourse || 'Engineering Track'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Workshop & Session */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {record.workshopTitle}
                        </p>
                        <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium truncate mt-0.5">
                          {record.sessionTitle || 'Session 1'}
                        </p>
                        <span className="text-[10px] font-mono text-slate-400">
                          {record.workshopId} • {record.sessionId || 'Default'}
                        </span>
                      </td>

                      {/* Session Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-brand-500" />
                          <span>{record.date}</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Checked-in: {record.time}
                        </p>
                      </td>

                      {/* Check-in Method & Server Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <QrCode className="w-3 h-3 text-brand-500" />
                          {record.checkInMethod}
                        </span>
                        {record.serverTimestamp && (
                          <p className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[140px]" title={record.serverTimestamp}>
                            ISO: {record.serverTimestamp.slice(11, 19)} UTC
                          </p>
                        )}
                      </td>

                      {/* Status & Quick Toggle */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {(['Present', 'Late', 'Absent', 'Excused'] as AttendanceStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                onClick={() => updateAttendanceStatus(record.id, st)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                  record.status === st
                                    ? st === 'Present'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : st === 'Late'
                                      ? 'bg-amber-600 text-white shadow-sm'
                                      : st === 'Absent'
                                      ? 'bg-rose-600 text-white shadow-sm'
                                      : 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {st}
                              </button>
                            )
                          )}
                        </div>
                      </td>

                      {/* Record ID */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-[10px] font-mono text-slate-400">
                          {record.id}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* QR Scanner Modal */}
      <QuickAttendanceModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading attendance center...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}
