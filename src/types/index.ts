export type WorkshopStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';

export interface WorkshopSession {
  id: string;
  workshopId: string;
  sessionTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  isActive?: boolean;
  qrToken?: string;
}

export interface Workshop {
  id: string;
  title: string;
  category: 'Web Dev' | 'AI & ML' | 'Cloud Computing' | 'Cybersecurity' | 'Data Science' | 'IoT & Robotics';
  trainer: string;
  trainerRole: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  capacity: number;
  enrolledCount: number;
  status: WorkshopStatus;
  price: number;
  description: string;
  tags: string[];
  sessions: WorkshopSession[];
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  regNo: string;
  college: string;
  batch: string;
  enrolledWorkshopIds: string[];
  totalAttended: number;
  status: 'Active' | 'Inactive';
  avatar?: string;
}

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Late'
  | 'Excused'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CERTIFICATE_ELIGIBLE';

export interface AttendanceRecord {
  id: string;
  workshopId: string;
  workshopTitle: string;
  sessionId: string;
  sessionTitle: string;
  studentId?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentCourse: string;
  studentRegNo?: string;
  date: string;
  time: string;
  serverTimestamp: string;
  status: AttendanceStatus;
  checkInMethod: 'QR Scan' | 'Manual' | 'RFID';
  notes?: string;
}

export type CertificateGrade = 'Distinction' | 'Merit' | 'Pass';

export interface Certificate {
  id: string;
  certificateNo: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  workshopId: string;
  workshopTitle: string;
  trainer: string;
  issueDate: string;
  grade: CertificateGrade;
  status: 'Issued' | 'Pending';
  score?: number;
  storagePath?: string;
  pdfUrl?: string;
  fileName?: string;
}

export type ZipItemMatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'duplicate';

export interface BulkZipEntry {
  id: string;
  fileName: string;
  cleanName: string;
  fileBlob: Blob;
  fileSize: number;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  status: ZipItemMatchStatus;
  confidence: number;
  errorMessage?: string;
  potentialMatches: Student[];
  manualMappingApproved?: boolean;
  manualMappingApprovedBy?: string;
  manualMappingApprovedAt?: string;
}

export interface DashboardMetric {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
  icon: string;
}
