import ExcelJS from 'exceljs';
import type { Workshop, WorkshopSession, AttendanceRecord } from '../types';

/**
 * Triggers browser download of Excel workbook buffer
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Applies shared header and metadata styling
 */
function applyHeaderBanner(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colSpan: number
) {
  // Title row
  worksheet.mergeCells(1, 1, 1, colSpan);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'TECHNOSAVVYS WORKSHOP MANAGEMENT SYSTEM';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' }, // Indigo 900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  // Subtitle / Report name
  worksheet.mergeCells(2, 1, 2, colSpan);
  const subCell = worksheet.getCell('A2');
  subCell.value = `${title.toUpperCase()} — ${subtitle}`;
  subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E1B4B' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' }, // Indigo 100
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 22;

  // Timestamp
  worksheet.mergeCells(3, 1, 3, colSpan);
  const timeCell = worksheet.getCell('A3');
  timeCell.value = `Report Generated: ${new Date().toLocaleString()} (UTC: ${new Date().toISOString()})`;
  timeCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  timeCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 18;

  worksheet.addRow([]); // Blank spacer
}

/**
 * Exports Attendance for an INDIVIDUAL Dated Workshop Session
 */
export async function exportSessionAttendanceToExcel(
  workshop: Workshop,
  session: WorkshopSession,
  records: AttendanceRecord[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Technosavvys WMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Session-${session.id}`);

  // Sort records chronologically (by time/timestamp)
  const sessionRecords = records
    .filter((r) => r.sessionId === session.id)
    .sort((a, b) => new Date(a.serverTimestamp || a.date).getTime() - new Date(b.serverTimestamp || b.date).getTime());

  const presentCount = sessionRecords.filter((r) => r.status === 'Present').length;
  const lateCount = sessionRecords.filter((r) => r.status === 'Late').length;
  const absentCount = sessionRecords.filter((r) => r.status === 'Absent').length;
  const totalCount = sessionRecords.length;
  const turnoutRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  // Header Banner
  applyHeaderBanner(
    worksheet,
    workshop.title,
    `${session.sessionTitle} (Date: ${session.date})`,
    8
  );

  // Summary Metrics Table
  const metaStartRow = 5;
  worksheet.addRow(['Workshop ID', workshop.id, 'Trainer', workshop.trainer, 'Total Logged', totalCount, 'Turnout Rate', `${turnoutRate}%`]);
  worksheet.addRow(['Session ID', session.id, 'Session Date', session.date, 'Present', presentCount, 'Late / Absent', `${lateCount} / ${absentCount}`]);
  worksheet.addRow(['Location', session.location, 'Time Window', `${session.startTime} - ${session.endTime}`, 'Category', workshop.category, 'Capacity', `${workshop.enrolledCount} / ${workshop.capacity}`]);

  for (let r = metaStartRow; r <= metaStartRow + 2; r++) {
    const row = worksheet.getRow(r);
    row.font = { name: 'Calibri', size: 9.5 };
    row.alignment = { vertical: 'middle' };
    [1, 3, 5, 7].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF475569' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
  }

  worksheet.addRow([]); // Blank spacer

  // Table Columns
  const tableHeaderRow = worksheet.addRow([
    'Sl. No',
    'Student Full Name',
    'Email Address',
    'Mobile Number',
    'Course / Academic Batch',
    'Session Date',
    'Check-In Time',
    'Attendance Status',
  ]);

  tableHeaderRow.height = 24;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
    };
  });

  // Data rows
  sessionRecords.forEach((rec, idx) => {
    const dataRow = worksheet.addRow([
      idx + 1,
      rec.studentName,
      rec.studentEmail,
      rec.studentPhone,
      rec.studentCourse,
      rec.date,
      rec.time,
      rec.status,
    ]);

    dataRow.height = 20;
    dataRow.font = { name: 'Calibri', size: 9.5 };

    // Alignments
    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    // Status colors
    const statusCell = dataRow.getCell(8);
    statusCell.font = { name: 'Calibri', size: 9.5, bold: true };
    if (rec.status === 'Present') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light emerald
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF166534' } };
    } else if (rec.status === 'Late') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light amber
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
    } else if (rec.status === 'Absent') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light rose
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
    }

    // Cell light borders
    dataRow.eachCell((c) => {
      c.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Auto column widths
  worksheet.columns = [
    { width: 8 },  // Sl
    { width: 26 }, // Name
    { width: 30 }, // Email
    { width: 18 }, // Phone
    { width: 32 }, // Course
    { width: 14 }, // Date
    { width: 15 }, // Time
    { width: 18 }, // Status
  ];

  await downloadWorkbook(workbook, `technosavvys-session-${session.id}-${session.date}.xlsx`);
}

/**
 * Exports Attendance for an ENTIRE WORKSHOP (All Dated Sessions, Chronologically Sorted)
 */
export async function exportWorkshopAttendanceToExcel(
  workshop: Workshop,
  records: AttendanceRecord[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Technosavvys WMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Workshop Attendance');

  // Filter records for this workshop and sort chronologically by date then time
  const workshopRecords = records
    .filter((r) => r.workshopId === workshop.id)
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.serverTimestamp || a.date).getTime() - new Date(b.serverTimestamp || b.date).getTime();
    });

  const presentCount = workshopRecords.filter((r) => r.status === 'Present').length;
  const lateCount = workshopRecords.filter((r) => r.status === 'Late').length;
  const absentCount = workshopRecords.filter((r) => r.status === 'Absent').length;
  const totalCount = workshopRecords.length;
  const turnoutRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  // Header Banner
  applyHeaderBanner(
    worksheet,
    workshop.title,
    `Complete Workshop Roster (${workshop.sessions?.length || 1} Dated Sessions)`,
    9
  );

  // Workshop Summary Block
  const metaStartRow = 5;
  worksheet.addRow(['Workshop ID', workshop.id, 'Category', workshop.category, 'Total Sessions', workshop.sessions?.length || 1, 'Total Logs', totalCount]);
  worksheet.addRow(['Lead Trainer', workshop.trainer, 'Trainer Role', workshop.trainerRole, 'Capacity', `${workshop.enrolledCount} / ${workshop.capacity}`, 'Overall Turnout', `${turnoutRate}%`]);
  worksheet.addRow(['Present Logs', presentCount, 'Late Logs', lateCount, 'Absent Logs', absentCount, 'Status', workshop.status]);

  for (let r = metaStartRow; r <= metaStartRow + 2; r++) {
    const row = worksheet.getRow(r);
    row.font = { name: 'Calibri', size: 9.5 };
    row.alignment = { vertical: 'middle' };
    [1, 3, 5, 7].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF475569' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
  }

  worksheet.addRow([]); // Blank spacer

  // Table Columns
  const tableHeaderRow = worksheet.addRow([
    'Sl. No',
    'Student Full Name',
    'Email Address',
    'Mobile Number',
    'Course / Academic Batch',
    'Session Title',
    'Session Date (Sorted)',
    'Check-In Time',
    'Attendance Status',
  ]);

  tableHeaderRow.height = 24;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } }; // Darker Indigo
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
    };
  });

  // Populate data chronologically
  workshopRecords.forEach((rec, idx) => {
    const dataRow = worksheet.addRow([
      idx + 1,
      rec.studentName,
      rec.studentEmail,
      rec.studentPhone,
      rec.studentCourse,
      rec.sessionTitle || 'General Session',
      rec.date,
      rec.time,
      rec.status,
    ]);

    dataRow.height = 20;
    dataRow.font = { name: 'Calibri', size: 9.5 };

    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

    // Status colors
    const statusCell = dataRow.getCell(9);
    statusCell.font = { name: 'Calibri', size: 9.5, bold: true };
    if (rec.status === 'Present') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF166534' } };
    } else if (rec.status === 'Late') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
    } else if (rec.status === 'Absent') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
    }

    dataRow.eachCell((c) => {
      c.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  worksheet.columns = [
    { width: 8 },  // Sl
    { width: 24 }, // Name
    { width: 28 }, // Email
    { width: 17 }, // Phone
    { width: 30 }, // Course
    { width: 34 }, // Session Title
    { width: 18 }, // Session Date
    { width: 15 }, // Time
    { width: 18 }, // Status
  ];

  await downloadWorkbook(workbook, `technosavvys-workshop-${workshop.id}-complete-attendance.xlsx`);
}

/**
 * Exports Master Attendance Register for ALL workshops
 */
export async function exportAllAttendanceToExcel(
  workshops: Workshop[],
  records: AttendanceRecord[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Technosavvys WMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Master Attendance Report');

  // Sort ALL records chronologically by session date
  const sortedRecords = [...records].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return new Date(a.serverTimestamp || a.date).getTime() - new Date(b.serverTimestamp || b.date).getTime();
  });

  applyHeaderBanner(
    worksheet,
    'INSTITUTIONAL MASTER ATTENDANCE REGISTER',
    `All Workshops & Sessions (${sortedRecords.length} Total Records)`,
    10
  );

  const tableHeaderRow = worksheet.addRow([
    'Sl. No',
    'Workshop Title',
    'Session Date (Sorted)',
    'Session Title',
    'Attendee Name',
    'Email Address',
    'Mobile Number',
    'Course / Branch',
    'Time',
    'Status',
  ]);

  tableHeaderRow.height = 24;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  sortedRecords.forEach((rec, idx) => {
    const dataRow = worksheet.addRow([
      idx + 1,
      rec.workshopTitle,
      rec.date,
      rec.sessionTitle || 'General Session',
      rec.studentName,
      rec.studentEmail,
      rec.studentPhone,
      rec.studentCourse,
      rec.time,
      rec.status,
    ]);

    dataRow.height = 19;
    dataRow.font = { name: 'Calibri', size: 9 };
    dataRow.eachCell((c) => {
      c.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  worksheet.columns = [
    { width: 8 },  // Sl
    { width: 30 }, // Workshop Title
    { width: 16 }, // Session Date
    { width: 28 }, // Session Title
    { width: 22 }, // Name
    { width: 26 }, // Email
    { width: 16 }, // Phone
    { width: 26 }, // Course
    { width: 14 }, // Time
    { width: 16 }, // Status
  ];

  await downloadWorkbook(workbook, `technosavvys-master-attendance-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}

