import fs from 'fs';
import path from 'path';
import { getAllWorkshops, deleteWorkshop } from './workshopStore';
import { getAllAttendanceRecords, deleteAttendanceByWorkshop } from './attendanceStore';
import { getAllCertificates, deleteUnpublishedCertificatesByWorkshop } from './certificateStore';
import { logAuditEvent } from './audit';
import { Workshop } from '@/types';

export interface CascadeDeleteResult {
  success: boolean;
  workshopId: string;
  backupPath: string;
  deletedWorkshop: Workshop | null;
  deletedAttendanceCount: number;
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

  // 1. Check for certificates
  const allCerts = await getAllCertificates({ workshopId });
  const publishedCerts = allCerts.filter((c) => c.status === 'Issued');
  const unpublishedCerts = allCerts.filter((c) => c.status !== 'Issued');

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
    unpublishedCertificates: unpublishedCerts,
    publishedCertificatesRetained: publishedCerts,
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  // 4. Perform Cascade Delete
  // Delete linked attendance
  const deletedAttendance = await deleteAttendanceByWorkshop(workshopId);

  // Delete unpublished certificates only
  const deletedCerts = await deleteUnpublishedCertificatesByWorkshop(workshopId);

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
      unpublishedCertsDeleted: deletedCerts.length,
      publishedCertsRetained: publishedCerts.length,
    },
  });

  return {
    success: true,
    workshopId,
    backupPath,
    deletedWorkshop: targetWs,
    deletedAttendanceCount: deletedAttendance.length,
    deletedUnpublishedCertificatesCount: deletedCerts.length,
    hasPublishedCertificates: publishedCerts.length > 0,
    publishedCertificatesCount: publishedCerts.length,
    message: `Cascade delete completed for workshop ${workshopId}. Backup saved to ${backupFilename}.`,
  };
}

