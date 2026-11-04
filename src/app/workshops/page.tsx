'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Workshop, WorkshopSession } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { NewWorkshopModal } from '@/components/modals/NewWorkshopModal';
import { SessionQRModal } from '@/components/modals/SessionQRModal';
import { AddSessionModal } from '@/components/modals/AddSessionModal';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Trash2,
  GraduationCap,
  Award,
  ChevronRight,
  UserCheck,
  Tag,
  QrCode,
  CalendarPlus,
  Layers
} from 'lucide-react';
import Link from 'next/link';

export default function WorkshopsPage() {
  const { workshops, students, deleteWorkshop, enrollStudentInWorkshop } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedWorkshopDetails, setSelectedWorkshopDetails] = useState<Workshop | null>(null);

  // QR & Sessions modal states
  const [qrModalData, setQrModalData] = useState<{ workshop: Workshop; session: WorkshopSession } | null>(null);
  const [sessionModalWorkshop, setSessionModalWorkshop] = useState<Workshop | null>(null);

  const categories = ['All', 'Web Dev', 'AI & ML', 'Cloud Computing', 'Cybersecurity', 'Data Science', 'IoT & Robotics'];
  const statuses = ['All', 'Upcoming', 'Ongoing', 'Completed'];

  const filteredWorkshops = workshops.filter((w) => {
    const matchesSearch =
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      w.trainer.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || w.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || w.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Workshop Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create, schedule, track enrollments and manage syllabus for all technical tracks.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsNewModalOpen(true)}
        >
          Create Workshop
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, speaker, or workshop ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 overflow-x-auto">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  selectedStatus === st
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Track:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-white font-medium shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Workshop Grid */}
      {filteredWorkshops.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Workshops Found
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No workshops match the selected search or filter criteria. Try adjusting your query or publish a new workshop.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch('');
              setSelectedCategory('All');
              setSelectedStatus('All');
            }}
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkshops.map((ws) => {
            const fillRate = Math.round((ws.enrolledCount / ws.capacity) * 100);
            const isOngoing = ws.status === 'Ongoing';

            return (
              <Card key={ws.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          ws.category === 'AI & ML'
                            ? 'purple'
                            : ws.category === 'Cloud Computing'
                            ? 'primary'
                            : ws.category === 'Cybersecurity'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {ws.category}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            ws.status === 'Ongoing'
                              ? 'success'
                              : ws.status === 'Upcoming'
                              ? 'primary'
                              : ws.status === 'Completed'
                              ? 'neutral'
                              : 'danger'
                          }
                        >
                          {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {ws.status}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-400">
                          {ws.id}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 line-clamp-2">
                      {ws.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                      {ws.description}
                    </p>

                    {/* Trainer info */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {ws.trainer.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {ws.trainer}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{ws.trainerRole}</p>
                      </div>
                    </div>

                    {/* Logistics */}
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ws.date} • {ws.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{ws.location}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {ws.tags && ws.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {ws.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Enrollment Progress & Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Enrollment</span>
                        <span>
                          <strong className="text-slate-900 dark:text-white">{ws.enrolledCount}</strong> / {ws.capacity} ({fillRate}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            fillRate >= 90 ? 'bg-amber-500' : 'bg-brand-600'
                          }`}
                          style={{ width: `${Math.min(100, fillRate)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedWorkshopDetails(ws)}
                      >
                        Details & Sessions
                      </Button>

                      <div className="flex items-center gap-1.5">
                        {ws.sessions && ws.sessions.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<QrCode className="w-3.5 h-3.5 text-brand-500" />}
                            onClick={() => setQrModalData({ workshop: ws, session: ws.sessions[0] })}
                            title="View Session Attendance QR"
                          >
                            QR
                          </Button>
                        )}
                        <Link href={`/attendance?workshopId=${ws.id}`}>
                          <Button size="sm" variant="outline" icon={<UserCheck className="w-3.5 h-3.5 text-emerald-500" />}>
                            Attendance
                          </Button>
                        </Link>
                        <button
                          onClick={() => deleteWorkshop(ws.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Workshop"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Workshop Details & Enrollment Modal */}
      {selectedWorkshopDetails && (
        <Modal
          isOpen={!!selectedWorkshopDetails}
          onClose={() => setSelectedWorkshopDetails(null)}
          title={selectedWorkshopDetails.title}
          description={`ID: ${selectedWorkshopDetails.id} • Track: ${selectedWorkshopDetails.category}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Trainer</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedWorkshopDetails.trainer}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Scheduled Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedWorkshopDetails.date}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Session Duration</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedWorkshopDetails.duration}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Status</p>
                <Badge variant={selectedWorkshopDetails.status === 'Ongoing' ? 'success' : 'primary'} className="mt-0.5">
                  {selectedWorkshopDetails.status}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Description & Course Scope
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedWorkshopDetails.description}
              </p>
            </div>

            {/* Dated Sessions & QR Codes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dated Sessions & Unique QR Codes ({selectedWorkshopDetails.sessions?.length || 0})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<CalendarPlus className="w-3.5 h-3.5 text-brand-500" />}
                  onClick={() => setSessionModalWorkshop(selectedWorkshopDetails)}
                >
                  Add Dated Session
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 max-h-48 overflow-y-auto">
                {selectedWorkshopDetails.sessions && selectedWorkshopDetails.sessions.length > 0 ? (
                  selectedWorkshopDetails.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {sess.sessionTitle}
                          </span>
                          <Badge variant={sess.status === 'Live' ? 'success' : 'neutral'} size="sm">
                            {sess.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {sess.date} • {sess.startTime} - {sess.endTime} • {sess.location}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        icon={<QrCode className="w-3.5 h-3.5" />}
                        onClick={() => setQrModalData({ workshop: selectedWorkshopDetails, session: sess })}
                      >
                        Show QR
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">
                    No dated sessions created yet. Click Add Dated Session to create one.
                  </p>
                )}
              </div>
            </div>

            {/* Enrolled Students Roster */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Enrolled Students ({selectedWorkshopDetails.enrolledCount} Attendees)
                </h4>
                <Link
                  href={`/attendance?workshopId=${selectedWorkshopDetails.id}`}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  Mark Session Attendance <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {students
                  .filter((s) => s.enrolledWorkshopIds.includes(selectedWorkshopDetails.id))
                  .map((stu) => (
                    <div key={stu.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                          {stu.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{stu.name}</p>
                          <p className="text-[10px] text-slate-400">{stu.regNo} • {stu.college}</p>
                        </div>
                      </div>
                      <Badge variant="success" size="sm">Enrolled</Badge>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link href={`/certificates?workshopId=${selectedWorkshopDetails.id}`}>
                <Button variant="outline" size="sm" icon={<Award className="w-4 h-4 text-amber-500" />}>
                  Issue Certificates
                </Button>
              </Link>
              <Button variant="secondary" onClick={() => setSelectedWorkshopDetails(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Workshop Modal */}
      <NewWorkshopModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />

      {/* Unique Session QR Code Modal */}
      <SessionQRModal
        isOpen={!!qrModalData}
        onClose={() => setQrModalData(null)}
        workshop={qrModalData?.workshop || null}
        session={qrModalData?.session || null}
      />

      {/* Add Dated Session Modal */}
      <AddSessionModal
        isOpen={!!sessionModalWorkshop}
        onClose={() => setSessionModalWorkshop(null)}
        workshop={sessionModalWorkshop}
      />
    </div>
  );
}

