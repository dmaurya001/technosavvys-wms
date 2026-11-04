'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  exportAllAttendanceToExcel,
  exportWorkshopAttendanceToExcel,
  exportSessionAttendanceToExcel,
} from '@/lib/excelExport';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle2,
  Users,
  Award,
  Zap,
  Clock,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  Filter,
  Check,
  CalendarDays
} from 'lucide-react';

export default function ReportsPage() {
  const { workshops, students, attendance, certificates, addToast } = useApp();
  const [timeRange, setTimeRange] = useState<'30days' | '90days' | 'all'>('30days');

  // Excel Export Selector state
  const [exportWorkshopId, setExportWorkshopId] = useState<string>('all');
  const [exportSessionId, setExportSessionId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Selected workshop for export
  const currentExportWorkshop = workshops.find((w) => w.id === exportWorkshopId);
  const currentWorkshopSessions = currentExportWorkshop?.sessions || [];

  // Compute metrics
  const totalLogs = attendance.length;
  const presentCount = attendance.filter((a) => a.status === 'Present' || a.status === 'Late').length;
  const overallTurnout = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 91;

  const totalCerts = certificates.length;
  const issuedCerts = certificates.filter((c) => c.status === 'Issued').length;
  const certCompletionRate = totalCerts > 0 ? Math.round((issuedCerts / totalCerts) * 100) : 85;

  // Chronologically sorted workshops by earliest session date
  const sortedWorkshops = useMemo(() => {
    return [...workshops].sort((a, b) => {
      const aDate = a.sessions?.[0]?.date || a.date;
      const bDate = b.sessions?.[0]?.date || b.date;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  }, [workshops]);

  // Chronologically sorted attendance logs
  const chronologicalAttendance = useMemo(() => {
    return [...attendance].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      return new Date(a.serverTimestamp || a.date).getTime() - new Date(b.serverTimestamp || b.date).getTime();
    });
  }, [attendance]);

  // Monthly trend metrics
  const monthlyTrends = [
    { month: 'Jun', turnout: 84, attendees: 180 },
    { month: 'Jul', turnout: 89, attendees: 240 },
    { month: 'Aug', turnout: 91, attendees: 310 },
    { month: 'Sep', turnout: 87, attendees: 290 },
    { month: 'Oct', turnout: 94, attendees: 380 },
    { month: 'Nov', turnout: 96, attendees: 420 },
  ];

  // Category distribution
  const categories = [
    { name: 'AI & ML', count: 184, color: 'bg-purple-500', pct: 32 },
    { name: 'Cloud Computing', count: 142, color: 'bg-blue-500', pct: 25 },
    { name: 'Web Dev', count: 110, color: 'bg-indigo-500', pct: 19 },
    { name: 'Cybersecurity', count: 72, color: 'bg-rose-500', pct: 13 },
    { name: 'Data Science', count: 64, color: 'bg-emerald-500', pct: 11 },
  ];

  // Trigger ExcelJS Export
  const handleExcelExport = async () => {
    setIsExporting(true);
    try {
      if (exportWorkshopId === 'all') {
        await exportAllAttendanceToExcel(workshops, attendance);
        addToast('Master institutional XLSX report generated successfully!', 'success');
      } else {
        const targetWs = workshops.find((w) => w.id === exportWorkshopId);
        if (!targetWs) return;

        if (exportSessionId === 'all') {
          await exportWorkshopAttendanceToExcel(targetWs, attendance);
          addToast(`Full workshop report for "${targetWs.title}" exported!`, 'success');
        } else {
          const targetSess = targetWs.sessions.find((s) => s.id === exportSessionId);
          if (targetSess) {
            await exportSessionAttendanceToExcel(targetWs, targetSess, attendance);
            addToast(`Session report for "${targetSess.sessionTitle}" exported!`, 'success');
          }
        }
      }
    } catch (err: any) {
      console.error('Export error:', err);
      addToast('Failed to generate Excel file: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleJsonSummaryExport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalWorkshops: workshops.length,
        totalRegisteredStudents: students.length,
        overallTurnoutRate: `${overallTurnout}%`,
        certificationCompletionRate: `${certCompletionRate}%`,
        totalAttendanceLogs: attendance.length,
      },
      workshopsChronological: sortedWorkshops.map((w) => ({
        id: w.id,
        title: w.title,
        category: w.category,
        earliestDate: w.sessions?.[0]?.date || w.date,
        sessionsCount: w.sessions?.length || 1,
        enrolled: w.enrolledCount,
        capacity: w.capacity,
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `technosavvys-analytics-summary-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addToast('JSON summary report downloaded.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics & Formatted Attendance Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Export formatted Excel (.XLSX) workbooks for workshops, dated sessions, or master registers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                timeRange === '30days'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeRange('90days')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                timeRange === '90days'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last Quarter
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                timeRange === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<FileText className="w-4 h-4 text-slate-400" />}
            onClick={handleJsonSummaryExport}
          >
            Export JSON
          </Button>
        </div>
      </div>

      {/* ExcelJS Export Hub Card */}
      <Card className="p-6 bg-gradient-to-r from-brand-900/90 via-indigo-950 to-slate-900 text-white border-brand-800/80 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ExcelJS High-Fidelity Workbook Generator</span>
            </div>
            <h2 className="text-xl font-bold">Export Formatted Attendance Spreadsheets</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Generates styled XLSX files with company headers, metrics banners, colored attendance status cells, and chronological sorting.
            </p>
          </div>

          {/* Export Selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Workshop Target */}
            <select
              value={exportWorkshopId}
              onChange={(e) => {
                setExportWorkshopId(e.target.value);
                setExportSessionId('all');
              }}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Export All Workshops (Master)</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.id}] {w.title.slice(0, 32)}...
                </option>
              ))}
            </select>

            {/* Session Target (when specific workshop selected) */}
            {exportWorkshopId !== 'all' && (
              <select
                value={exportSessionId}
                onChange={(e) => setExportSessionId(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Sessions in Workshop</option>
                {currentWorkshopSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionTitle.slice(0, 28)} ({s.date})
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="primary"
              size="md"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/30 whitespace-nowrap"
              icon={<Download className="w-4 h-4" />}
              isLoading={isExporting}
              onClick={handleExcelExport}
            >
              {exportWorkshopId === 'all'
                ? 'Export Master XLSX'
                : exportSessionId === 'all'
                ? 'Export Full Workshop XLSX'
                : 'Export Session XLSX'}
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Overall Attendance Turnout"
          value={`${overallTurnout}%`}
          change="+6.1% YoY"
          trend="up"
          description="Average across all workshops"
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400"
        />

        <StatCard
          title="Certificate Pass Rate"
          value={`${certCompletionRate}%`}
          change="+2.4% vs last term"
          trend="up"
          description="Eligible completed participants"
          icon={<Award className="w-5 h-5" />}
          iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400"
        />

        <StatCard
          title="Active Technical Tracks"
          value={`${workshops.length} Tracks`}
          change="100% curriculum coverage"
          trend="neutral"
          description="AI, Cloud, Full-Stack, Cyber, IoT"
          icon={<Zap className="w-5 h-5" />}
          iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
        />

        <StatCard
          title="Cumulative Training Hours"
          value="42.5 hrs"
          change="32 contact sessions"
          trend="up"
          description="Delivered this calendar month"
          icon={<Clock className="w-5 h-5" />}
          iconBg="bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-400"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Attendance Chart (2 Columns) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Monthly Attendance & Turnout Trajectory"
              subtitle="Attendee participation curve and percentage consistency"
            />
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-4 border-b border-slate-100 dark:border-slate-800">
                {monthlyTrends.map((item) => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[11px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.turnout}%
                    </span>
                    <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden h-44 flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-brand-600 to-indigo-500 rounded-t-lg group-hover:from-brand-500 group-hover:to-cyan-400 transition-all duration-300 shadow-sm"
                        style={{ height: `${item.turnout}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {item.month}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.attendees} att.
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-brand-600" />
                  <span>Turnout % Performance</span>
                </div>
                <span>Peak Turnout: <strong>96% (Nov 2026)</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown (1 Column) */}
        <div>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader
              title="Attendance by Technology Domain"
              subtitle="Participant volume breakdown"
            />
            <CardContent className="space-y-4 flex-1 flex flex-col justify-center">
              {categories.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {cat.name}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {cat.count} ({cat.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.color}`}
                      style={{ width: `${cat.pct * 2}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workshop Performance Ranking Table (Chronologically Sorted by Earliest Date) */}
      <Card>
        <CardHeader
          title="Workshop Performance & Chronological Date Index"
          subtitle="Workshops sorted chronologically by first scheduled session date"
          action={
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="w-3.5 h-3.5 text-emerald-500" />}
              onClick={() => exportAllAttendanceToExcel(workshops, attendance)}
            >
              Export Register (.xlsx)
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Earliest Session Date</th>
                <th className="py-3 px-4">Workshop</th>
                <th className="py-3 px-4">Track</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Enrolled / Cap</th>
                <th className="py-3 px-4">Fill Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {sortedWorkshops.map((w) => {
                const fillRate = Math.round((w.enrolledCount / w.capacity) * 100);
                const earliestDate = w.sessions?.[0]?.date || w.date;

                return (
                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                      {earliestDate}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {w.title}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        Trainer: {w.trainer}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral" size="sm">{w.category}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {w.sessions?.length || 1} session(s)
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {w.enrolledCount} / {w.capacity}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-brand-600 rounded-full"
                            style={{ width: `${Math.min(100, fillRate)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs">{fillRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />}
                        onClick={() => exportWorkshopAttendanceToExcel(w, attendance)}
                      >
                        Export XLSX
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
