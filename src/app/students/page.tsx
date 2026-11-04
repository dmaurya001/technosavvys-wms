'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Student } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { NewStudentModal } from '@/components/modals/NewStudentModal';
import {
  GraduationCap,
  Search,
  Plus,
  Mail,
  Phone,
  BookOpen,
  CalendarCheck2,
  Award,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  Building2,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Filter
} from 'lucide-react';
import Link from 'next/link';

export default function StudentsPage() {
  const { students, workshops, attendance, certificates, enrollStudentInWorkshop } = useApp();
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedWorkshopFilter, setSelectedWorkshopFilter] = useState<string>('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Modals state
  const [isNewStudentModalOpen, setIsNewStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [enrollWorkshopId, setEnrollWorkshopId] = useState<string>('');

  const batches = ['All', 'Batch 2026 - CSE', 'Batch 2026 - AI&DS', 'Batch 2025 - IT', 'Batch 2026 - CyberSec'];

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.regNo.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search)) ||
        s.college.toLowerCase().includes(search.toLowerCase());

      const matchesBatch = selectedBatch === 'All' || s.batch === selectedBatch;
      const matchesStatus = selectedStatusFilter === 'All' || s.status === selectedStatusFilter;
      const matchesWorkshop =
        selectedWorkshopFilter === 'All' || s.enrolledWorkshopIds.includes(selectedWorkshopFilter);

      return matchesSearch && matchesBatch && matchesStatus && matchesWorkshop;
    });
  }, [students, search, selectedBatch, selectedStatusFilter, selectedWorkshopFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const handleEnroll = () => {
    if (!selectedStudent || !enrollWorkshopId) return;
    enrollStudentInWorkshop(selectedStudent.id, enrollWorkshopId);
    setEnrollWorkshopId('');
  };

  // Helper: compute workshop-wise attendance for a given student
  const getStudentWorkshopAttendance = (studentId: string, workshopId: string) => {
    const workshop = workshops.find((w) => w.id === workshopId);
    if (!workshop) return null;

    const totalSessions = workshop.sessions?.length || 1;
    // Count attendance logs for this student in this workshop with status Present or Late
    const attendedSessions = attendance.filter(
      (a) =>
        (a.studentId === studentId || a.studentEmail === students.find((s) => s.id === studentId)?.email) &&
        a.workshopId === workshopId &&
        (a.status === 'Present' || a.status === 'Late')
    ).length;

    const rate = Math.min(100, Math.round((attendedSessions / totalSessions) * 100));
    const isEligible = rate >= 75;

    return {
      workshopTitle: workshop.title,
      category: workshop.category,
      totalSessions,
      attendedSessions,
      rate,
      isEligible,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Student & Attendee Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Student directory, workshop-wise attendance breakdown, and certification eligibility tracking.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsNewStudentModalOpen(true)}
        >
          Enroll Student
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll number, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Workshop Filter */}
          <div>
            <select
              value={selectedWorkshopFilter}
              onChange={(e) => {
                setSelectedWorkshopFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="All">All Workshops</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.id}] {w.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Batch Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Batch:</span>
          {batches.map((b) => (
            <button
              key={b}
              onClick={() => {
                setSelectedBatch(b);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors font-medium ${
                selectedBatch === b
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </Card>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedStudents.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No students found matching your criteria.
          </div>
        ) : (
          paginatedStudents.map((student) => {
            const studentWorkshops = workshops.filter((w) =>
              student.enrolledWorkshopIds.includes(w.id)
            );

            return (
              <Card
                key={student.id}
                className="hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {student.name}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400">
                            {student.regNo}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={student.status === 'Active' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {student.status}
                      </Badge>
                    </div>

                    {/* Contact details */}
                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{student.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{student.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{student.college}</span>
                      </div>
                    </div>

                    {/* Workshop-Wise Attendance Breakdown */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Workshop Attendance
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {studentWorkshops.length} Enrolled
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {studentWorkshops.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-1">No enrolled workshops</p>
                        ) : (
                          studentWorkshops.map((w) => {
                            const attInfo = getStudentWorkshopAttendance(student.id, w.id);
                            if (!attInfo) return null;

                            return (
                              <div
                                key={w.id}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {w.title}
                                  </span>
                                  <span className="font-bold text-brand-600 dark:text-brand-400 shrink-0">
                                    {attInfo.rate}%
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>
                                    {attInfo.attendedSessions} / {attInfo.totalSessions} Sessions Attended
                                  </span>
                                  {attInfo.isEligible ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> Eligible
                                    </span>
                                  ) : (
                                    <span className="text-amber-500 font-semibold flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3" /> Needs Turnout
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Total Logs: <strong className="text-slate-900 dark:text-white">{student.totalAttended}</strong>
                    </span>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedStudent(student)}
                    >
                      Full Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredStudents.length > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
            <strong className="text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{filteredStudents.length}</strong> students
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                  currentPage === page
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {page}
              </button>
            ))}

            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Detailed Student Profile & Workshop-wise Modal */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={selectedStudent.name}
          description={`Roll ID: ${selectedStudent.regNo} • ${selectedStudent.batch}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Contact banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Email Address</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {selectedStudent.email}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Phone</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {selectedStudent.phone}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Institution</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {selectedStudent.college}
                </p>
              </div>
            </div>

            {/* Comprehensive Workshop-Wise Attendance Matrix */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Workshop-Wise Attendance Matrix & Certification Eligibility
              </h4>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {selectedStudent.enrolledWorkshopIds.map((wId) => {
                  const att = getStudentWorkshopAttendance(selectedStudent.id, wId);
                  if (!att) return null;

                  return (
                    <div key={wId} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {att.workshopTitle}
                          </span>
                          <Badge variant="primary" size="sm">{att.category}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Attended {att.attendedSessions} of {att.totalSessions} scheduled sessions
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block">
                          {att.rate}%
                        </span>
                        {att.isEligible ? (
                          <Badge variant="success" size="sm">
                            Certificate Eligible
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Under 75% Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Enroll in Another Workshop */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Enroll Student in Another Workshop
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={enrollWorkshopId}
                  onChange={(e) => setEnrollWorkshopId(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Select a workshop to assign...</option>
                  {workshops
                    .filter((w) => !selectedStudent.enrolledWorkshopIds.includes(w.id))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        [{w.id}] {w.title} ({w.category})
                      </option>
                    ))}
                </select>
                <Button size="sm" variant="primary" onClick={handleEnroll} disabled={!enrollWorkshopId}>
                  Enroll
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Student Modal */}
      <NewStudentModal
        isOpen={isNewStudentModalOpen}
        onClose={() => setIsNewStudentModalOpen(false)}
      />
    </div>
  );
}
