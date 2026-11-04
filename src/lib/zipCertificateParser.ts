import JSZip from 'jszip';
import type { Student, BulkZipEntry, Certificate, ZipItemMatchStatus } from '../types';

export const MAX_ZIP_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_SINGLE_PDF_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_UNCOMPRESSED_SIZE = 100 * 1024 * 1024; // 100MB

export interface ParseZipResult {
  success: boolean;
  entries: BulkZipEntry[];
  totalFiles: number;
  matchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  error?: string;
}

/**
 * Normalizes filenames for fuzzy/clean matching
 * e.g., "Rahul_Kumar.pdf" -> "rahul kumar"
 * e.g., "Krishna-Verma.PDF" -> "krishna verma"
 */
export function normalizeFileName(fileName: string): string {
  // Strip path if nested
  const baseName = fileName.split('/').pop()?.split('\\').pop() || fileName;
  return baseName
    .replace(/\.pdf$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Safely parses and validates uploaded ZIP archive of student certificates
 */
export async function parseAndMatchCertificateZip(
  file: File,
  students: Student[],
  existingWorkshopCertificates: Certificate[],
  enrolledStudentIds: string[]
): Promise<ParseZipResult> {
  // 1. File size validation
  if (file.size > MAX_ZIP_FILE_SIZE) {
    return {
      success: false,
      entries: [],
      totalFiles: 0,
      matchedCount: 0,
      ambiguousCount: 0,
      unmatchedCount: 0,
      duplicateCount: 0,
      error: `ZIP archive exceeds the maximum allowed size of 50MB (Uploaded: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  const entries: BulkZipEntry[] = [];
  let totalUncompressedSize = 0;

  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    // Track assigned students inside this ZIP to catch intra-ZIP duplicates
    const assignedStudentIdsInZip = new Set<string>();

    for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
      // Ignore directories and OS metadata
      if (zipEntry.dir) continue;
      if (
        relativePath.includes('__MACOSX') ||
        relativePath.startsWith('.') ||
        relativePath.endsWith('.DS_Store')
      ) {
        continue;
      }

      // Security check: ZIP Slip Protection (prevent path traversal)
      if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        return {
          success: false,
          entries: [],
          totalFiles: 0,
          matchedCount: 0,
          ambiguousCount: 0,
          unmatchedCount: 0,
          duplicateCount: 0,
          error: `Security Violation: ZIP contains illegal path traversal ("${relativePath}"). Operation aborted.`,
        };
      }

      // MIME check: Only .pdf accepted
      if (!relativePath.toLowerCase().endsWith('.pdf')) {
        continue; // Skip non-PDF files
      }

      // Unpack binary as Blob
      const pdfBlob = await zipEntry.async('blob');

      // Size checks
      if (pdfBlob.size > MAX_SINGLE_PDF_SIZE) {
        return {
          success: false,
          entries: [],
          totalFiles: 0,
          matchedCount: 0,
          ambiguousCount: 0,
          unmatchedCount: 0,
          duplicateCount: 0,
          error: `File "${relativePath}" exceeds maximum single PDF limit of 10MB (${(pdfBlob.size / (1024 * 1024)).toFixed(1)}MB).`,
        };
      }

      totalUncompressedSize += pdfBlob.size;
      if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
        return {
          success: false,
          entries: [],
          totalFiles: 0,
          matchedCount: 0,
          ambiguousCount: 0,
          unmatchedCount: 0,
          duplicateCount: 0,
          error: 'Security Violation: Total uncompressed content exceeds safe limit of 100MB (ZIP bomb protection).',
        };
      }

      const cleanName = normalizeFileName(relativePath);
      const baseFileName = relativePath.split('/').pop() || relativePath;

      // Matching Logic
      let matchedStudent: Student | null = null;
      let matchStatus: ZipItemMatchStatus = 'unmatched';
      let confidence = 0;
      let potentialMatches: Student[] = [];
      let errorMessage: string | undefined;

      // Filter enrolled students first for higher relevance
      const candidateStudents = students;

      // Step A: Exact Normalized Name Match
      const exactMatches = candidateStudents.filter(
        (s) => s.name.toLowerCase().trim() === cleanName
      );

      // Step B: Roll/Reg ID embedded in filename
      const regMatches = candidateStudents.filter(
        (s) => cleanName.includes(s.regNo.toLowerCase().replace(/[-_.]/g, '')) ||
               cleanName.includes(s.regNo.toLowerCase())
      );

      // Step C: Fuzzy word token match (e.g. "rahul kumar" vs "rahul k")
      const nameTokens = cleanName.split(' ').filter((t) => t.length > 2);
      const tokenMatches = candidateStudents.filter((s) => {
        const studentTokens = s.name.toLowerCase().split(' ');
        return nameTokens.every((nt) => studentTokens.some((st) => st.includes(nt)));
      });

      if (regMatches.length === 1) {
        matchedStudent = regMatches[0];
        matchStatus = 'matched';
        confidence = 1.0;
        potentialMatches = [matchedStudent];
      } else if (exactMatches.length === 1) {
        matchedStudent = exactMatches[0];
        matchStatus = 'matched';
        confidence = 0.95;
        potentialMatches = [matchedStudent];
      } else if (exactMatches.length > 1) {
        matchedStudent = null; // Strictly do not auto-assign duplicate names
        matchStatus = 'ambiguous';
        confidence = 0.5;
        potentialMatches = exactMatches;
        errorMessage = `Duplicate student name detected: ${exactMatches.length} students share the name "${cleanName}". Manual selection required.`;
      } else if (tokenMatches.length === 1) {
        matchedStudent = tokenMatches[0];
        matchStatus = 'matched';
        confidence = 0.85;
        potentialMatches = [matchedStudent];
      } else if (tokenMatches.length > 1) {
        matchedStudent = null; // Strictly do not auto-assign similar names
        matchStatus = 'ambiguous';
        confidence = 0.4;
        potentialMatches = tokenMatches;
        errorMessage = `Multiple similar student matches found (${tokenMatches.map((s) => s.name).join(', ')}). Manual confirmation required.`;
      } else {
        matchedStudent = null;
        matchStatus = 'unmatched';
        confidence = 0;
        potentialMatches = candidateStudents;
        errorMessage = 'No registered student matched this filename. Select student manually.';
      }

      // Step D: Duplicate Checks
      if (matchedStudent) {
        // Check if certificate already issued in DB for this workshop
        const alreadyIssued = existingWorkshopCertificates.find(
          (c) => c.studentId === matchedStudent!.id
        );
        if (alreadyIssued) {
          matchStatus = 'duplicate';
          errorMessage = `Duplicate: Certificate #${alreadyIssued.certificateNo} already exists for ${matchedStudent.name} in this workshop.`;
        }

        // Check if another PDF in this same ZIP already claimed this student
        if (assignedStudentIdsInZip.has(matchedStudent.id)) {
          matchStatus = 'duplicate';
          errorMessage = `Duplicate in ZIP: Multiple PDFs map to ${matchedStudent.name}.`;
        } else if (matchStatus === 'matched') {
          assignedStudentIdsInZip.add(matchedStudent.id);
        }
      }

      entries.push({
        id: `zip-item-${entries.length + 1}-${Date.now()}`,
        fileName: baseFileName,
        cleanName,
        fileBlob: pdfBlob,
        fileSize: pdfBlob.size,
        matchedStudentId: matchedStudent?.id || null,
        matchedStudentName: matchedStudent?.name || null,
        status: matchStatus,
        confidence,
        errorMessage,
        potentialMatches,
      });
    }

    if (entries.length === 0) {
      return {
        success: false,
        entries: [],
        totalFiles: 0,
        matchedCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
        duplicateCount: 0,
        error: 'The uploaded ZIP archive contains no valid PDF certificate files.',
      };
    }

    const matchedCount = entries.filter((e) => e.status === 'matched').length;
    const ambiguousCount = entries.filter((e) => e.status === 'ambiguous').length;
    const unmatchedCount = entries.filter((e) => e.status === 'unmatched').length;
    const duplicateCount = entries.filter((e) => e.status === 'duplicate').length;

    return {
      success: true,
      entries,
      totalFiles: entries.length,
      matchedCount,
      ambiguousCount,
      unmatchedCount,
      duplicateCount,
    };
  } catch (err: any) {
    return {
      success: false,
      entries: [],
      totalFiles: 0,
      matchedCount: 0,
      ambiguousCount: 0,
      unmatchedCount: 0,
      duplicateCount: 0,
      error: `Failed to unpack ZIP archive: ${err.message || 'Corrupted or unsupported format.'}`,
    };
  }
}

