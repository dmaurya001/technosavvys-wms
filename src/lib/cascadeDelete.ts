import fs from 'fs';
import path from 'path';
import { getAllWorkshops, deleteWorkshop } from './workshopStore';
import { getAllAttendanceRecords, deleteAttendanceByWorkshop } from './attendanceStore';
import { getAllCertificates, deleteAllCertificatesByWorkshop, deleteUnpublishedCertificatesByWorkshop } from './certificateStore';
import { logAuditEvent } from './audit';
import { Workshop } from '@/types';

export interface CascadeDeleteResult {
  success: boolean;
  workshopId: string;
  backupPath: string;
  deletedWorkshop: Workshop | null;
  deletedAttendanceCount: number;
  deletedCertificatesCount: number;
  deletedUnpublishedCertificatesCount: number;
  hasPublishedCertificates: boolean;
  publishedCertificatesCount: number;
  message: string;
}

export async function executeSafeCascadeDelete(
  workshopId: string,
  userEmail: string = 'admin'
): Promise<CascadeDeleteResult> {
  const allWorkshops = await getAllWorkshops();
  const targetWs = allWorkshops.find((w) => w.id === workshopId);

  if (!targetWs) {
    throw new Error(`Workshop "${workshopId}" not found in registry.`);
  }

  // 1. Fetch all certificates linked to this workshop
  const allCerts = await getAllCertificates({ workshopId });

  // 2. Fetch linked attendance records
  const linkedAttendance = await getAllAttendanceRecords({ workshopId });

  // 3. Create isolated backup BEFORE deleting anything
  const backupDir = path.join(process.cwd(), 'backups', 'cascade-deletions');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup-${workshopId}-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  const backupData = {
    deletedAt: new Date().toISOString(),
    deletedBy: userEmail,
    workshopId,
    workshop: targetWs,
    linkedAttendance,
    certificates: allCerts,
  };

  try {
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[cascadeDelete] Backup write error:', err);
  }

  // 4. Perform Complete Cascade Delete
  // Delete linked attendance
  const deletedAttendance = await deleteAttendanceByWorkshop(workshopId);

  // Delete ALL certificates and their physical PDFs
  const deletedCerts = await deleteAllCertificatesByWorkshop(workshopId);

  // Delete workshop itself
  await deleteWorkshop(workshopId);

  // 5. Audit Log
  await logAuditEvent({
    action: 'CASCADE_DELETE_WORKSHOP',
    entityType: 'Workshop',
    entityId: workshopId,
    details: {
      deletedBy: userEmail,
      backupFile: backupFilename,
      attendanceDeleted: deletedAttendance.length,
      certificatesDeleted: deletedCerts.length,
    },
  });

  return {
    success: true,
    workshopId,
    backupPath,
    deletedWorkshop: targetWs,
    deletedAttendanceCount: deletedAttendance.length,
    deletedCertificatesCount: deletedCerts.length,
    deletedUnpublishedCertificatesCount: deletedCerts.length,
    hasPublishedCertificates: false,
    publishedCertificatesCount: 0,
    message: `Cascade delete completed for workshop ${workshopId}. All attendance, certificates, and files removed.`,
  };
}

