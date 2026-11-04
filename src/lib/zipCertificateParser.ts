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
  suggestedCount: number;
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
  enrolledStudentIds: string[],
  approvedStudentIds?: string[]
): Promise<ParseZipResult> {
  // 1. File size validation
  if (file.size > MAX_ZIP_FILE_SIZE) {
    return {
      success: false,
      entries: [],
      totalFiles: 0,
      matchedCount: 0,
      suggestedCount: 0,
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
          suggestedCount: 0,
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
          suggestedCount: 0,
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
          suggestedCount: 0,
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

      // Filter candidates: prioritize approved attendees, then enrolled, else all students
      let candidateStudents = students;
      if (approvedStudentIds && approvedStudentIds.length > 0) {
        candidateStudents = students.filter((s) => approvedStudentIds.includes(s.id));
      } else if (enrolledStudentIds && enrolledStudentIds.length > 0) {
        candidateStudents = students.filter((s) => enrolledStudentIds.includes(s.id));
      }

      // Step A: Roll/Reg ID embedded in filename
      const regMatches = candidateStudents.filter(
        (s) => cleanName.includes(s.regNo.toLowerCase().replace(/[-_.]/g, '')) ||
               cleanName.includes(s.regNo.toLowerCase())
      );

      // Step B: Exact Normalized Full Name Match
      const exactMatches = candidateStudents.filter(
        (s) => s.name.toLowerCase().trim() === cleanName
      );

      // Step C: Fuzzy word token match (e.g. "rahul kumar" vs "rahul k")
      const nameTokens = cleanName.split(' ').filter((t) => t.length >= 2);
      const tokenMatches = candidateStudents.filter((s) => {
        if (nameTokens.length <= 1) return false;
        const studentTokens = s.name.toLowerCase().split(' ');
        return nameTokens.every((nt) => studentTokens.some((st) => st.includes(nt)));
      });

      // Step D: Partial Name Match (e.g. "Deepak.pdf" -> "Deepak Maurya")
      const partialCandidates = candidateStudents.filter((s) => {
        const studentNameLower = s.name.toLowerCase().trim();
        const studentWords = studentNameLower.split(' ');
        if (nameTokens.length === 1) {
          const token = nameTokens[0];
          return (
            studentWords[0] === token ||
            studentWords.slice(-1)[0] === token ||
            studentWords.includes(token) ||
            studentNameLower.startsWith(token + ' ') ||
            studentNameLower.endsWith(' ' + token) ||
            (token.length >= 3 && studentNameLower.includes(token))
          );
        }
        return false;
      });

      if (regMatches.length === 1) {
        matchedStudent = regMatches[0];
        matchStatus = 'matched';
        confidence = 1.0;
        potentialMatches = [matchedStudent];
      } else if (exactMatches.length === 1) {
        matchedStudent = exactMatches[0];
        matchStatus = 'matched';
        confidence = 0.98;
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
        confidence = 0.90;
        potentialMatches = [matchedStudent];
      } else if (tokenMatches.length > 1) {
        matchedStudent = null; // Strictly do not auto-assign similar names
        matchStatus = 'ambiguous';
        confidence = 0.4;
        potentialMatches = tokenMatches;
        errorMessage = `Multiple similar student matches found (${tokenMatches.map((s) => s.name).join(', ')}). Manual confirmation required.`;
      } else if (partialCandidates.length === 1) {
        // Unique partial match -> Suggested match!
        matchedStudent = partialCandidates[0];
        matchStatus = 'suggested';
        confidence = 0.75;
        potentialMatches = [matchedStudent];
        errorMessage = `Suggested match: "${matchedStudent.name}". Admin confirmation required before publishing.`;
      } else if (partialCandidates.length > 1) {
        // Multiple partial matches -> Ambiguous!
        matchedStudent = null;
        matchStatus = 'ambiguous';
        confidence = 0.35;
        potentialMatches = partialCandidates;
        errorMessage = `Multiple eligible students match "${cleanName}" (${partialCandidates.map((s) => s.name).join(', ')}). Manual selection required.`;
      } else {
        matchedStudent = null;
        matchStatus = 'unmatched';
        confidence = 0;
        potentialMatches = candidateStudents;
        errorMessage = 'No eligible student matched this filename. Select student manually.';
      }

      // Step E: Duplicate Checks
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
        suggestedCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
        duplicateCount: 0,
        error: 'The uploaded ZIP archive contains no valid PDF certificate files.',
      };
    }

    const matchedCount = entries.filter((e) => e.status === 'matched').length;
    const suggestedCount = entries.filter((e) => e.status === 'suggested').length;
    const ambiguousCount = entries.filter((e) => e.status === 'ambiguous').length;
    const unmatchedCount = entries.filter((e) => e.status === 'unmatched').length;
    const duplicateCount = entries.filter((e) => e.status === 'duplicate').length;

    return {
      success: true,
      entries,
      totalFiles: entries.length,
      matchedCount,
      suggestedCount,
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
      suggestedCount: 0,
      ambiguousCount: 0,
      unmatchedCount: 0,
      duplicateCount: 0,
      error: `Failed to unpack ZIP archive: ${err.message || 'Corrupted or unsupported format.'}`,
    };
  }
}

/**
 * Matches a single PDF blob against eligible students
 */
export function matchSinglePdfItem(
  fileName: string,
  blob: Blob,
  students: Student[],
  existingWorkshopCertificates: Certificate[],
  assignedStudentIds: Set<string>,
  approvedStudentIds?: string[]
): BulkZipEntry {
  const cleanName = normalizeFileName(fileName);
  const baseFileName = fileName.split('/').pop()?.split('\\').pop() || fileName;

  let candidateStudents = students;
  if (approvedStudentIds && approvedStudentIds.length > 0) {
    candidateStudents = students.filter((s) => approvedStudentIds.includes(s.id));
  }

  // 1. Roll / Reg ID exact embedding
  const regMatches = candidateStudents.filter(
    (s) =>
      cleanName.includes(s.regNo.toLowerCase().replace(/[-_.]/g, '')) ||
      cleanName.includes(s.regNo.toLowerCase())
  );

  // 2. Exact Normalized Full Name Match
  const exactMatches = candidateStudents.filter(
    (s) => s.name.toLowerCase().trim() === cleanName
  );

  // 3. Multi-word token match
  const nameTokens = cleanName.split(' ').filter((t) => t.length >= 2);
  const tokenMatches = candidateStudents.filter((s) => {
    if (nameTokens.length <= 1) return false;
    const studentTokens = s.name.toLowerCase().split(' ');
    return nameTokens.every((nt) => studentTokens.some((st) => st.includes(nt)));
  });

  // 4. Partial Name Match (Single token partial like "Deepak.pdf" -> "Deepak Maurya")
  const partialCandidates = candidateStudents.filter((s) => {
    const studentNameLower = s.name.toLowerCase().trim();
    const studentWords = studentNameLower.split(' ');
    if (nameTokens.length === 1) {
      const token = nameTokens[0];
      return (
        studentWords[0] === token ||
        studentWords.slice(-1)[0] === token ||
        studentWords.includes(token) ||
        studentNameLower.startsWith(token + ' ') ||
        studentNameLower.endsWith(' ' + token) ||
        (token.length >= 3 && studentNameLower.includes(token))
      );
    }
    return false;
  });

  let matchedStudent: Student | null = null;
  let matchStatus: ZipItemMatchStatus = 'unmatched';
  let confidence = 0;
  let potentialMatches: Student[] = [];
  let errorMessage: string | undefined;

  if (regMatches.length === 1) {
    matchedStudent = regMatches[0];
    matchStatus = 'matched';
    confidence = 1.0;
    potentialMatches = [matchedStudent];
  } else if (exactMatches.length === 1) {
    matchedStudent = exactMatches[0];
    matchStatus = 'matched';
    confidence = 0.98;
    potentialMatches = [matchedStudent];
  } else if (exactMatches.length > 1) {
    matchedStudent = null;
    matchStatus = 'ambiguous';
    confidence = 0.5;
    potentialMatches = exactMatches;
    errorMessage = `Duplicate student name: ${exactMatches.length} students share the name "${cleanName}". Manual selection required.`;
  } else if (tokenMatches.length === 1) {
    matchedStudent = tokenMatches[0];
    matchStatus = 'matched';
    confidence = 0.90;
    potentialMatches = [matchedStudent];
  } else if (tokenMatches.length > 1) {
    matchedStudent = null;
    matchStatus = 'ambiguous';
    confidence = 0.4;
    potentialMatches = tokenMatches;
    errorMessage = `Multiple similar student matches found (${tokenMatches.map((s) => s.name).join(', ')}). Manual confirmation required.`;
  } else if (partialCandidates.length === 1) {
    // Unique partial match -> Suggested match!
    matchedStudent = partialCandidates[0];
    matchStatus = 'suggested';
    confidence = 0.75;
    potentialMatches = [matchedStudent];
    errorMessage = `Suggested match: "${matchedStudent.name}". Admin confirmation required before publishing.`;
  } else if (partialCandidates.length > 1) {
    // Multiple partial matches -> Ambiguous!
    matchedStudent = null;
    matchStatus = 'ambiguous';
    confidence = 0.35;
    potentialMatches = partialCandidates;
    errorMessage = `Multiple eligible students match "${cleanName}" (${partialCandidates.map((s) => s.name).join(', ')}). Manual selection required.`;
  } else {
    matchedStudent = null;
    matchStatus = 'unmatched';
    confidence = 0;
    potentialMatches = candidateStudents;
    errorMessage = 'No eligible approved student matched this filename. Select student manually.';
  }

  // Duplicate checks
  if (matchedStudent) {
    const alreadyIssued = existingWorkshopCertificates.find(
      (c) => c.studentId === matchedStudent!.id
    );
    if (alreadyIssued) {
      matchStatus = 'duplicate';
      errorMessage = `Duplicate: Certificate #${alreadyIssued.certificateNo} already exists for ${matchedStudent.name} in this workshop.`;
    } else if (assignedStudentIds.has(matchedStudent.id)) {
      matchStatus = 'duplicate';
      errorMessage = `Duplicate in batch: Multiple files map to ${matchedStudent.name}.`;
    } else if (matchStatus === 'matched') {
      assignedStudentIds.add(matchedStudent.id);
    }
  }

  return {
    id: `cert-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fileName: baseFileName,
    cleanName,
    fileBlob: blob,
    fileSize: blob.size,
    matchedStudentId: matchedStudent?.id || null,
    matchedStudentName: matchedStudent?.name || null,
    suggestedStudentId: matchStatus === 'suggested' && matchedStudent ? matchedStudent.id : undefined,
    suggestedStudentName: matchStatus === 'suggested' && matchedStudent ? matchedStudent.name : undefined,
    status: matchStatus,
    confidence,
    errorMessage,
    potentialMatches,
  };
}

/**
 * Unified file processor: handles individual PDFs, multiple PDFs, and ZIP archives.
 * Merges new items into existing entries while preventing duplicate filename uploads.
 */
export async function parseAndMatchFiles(
  files: File[],
  students: Student[],
  existingWorkshopCertificates: Certificate[],
  enrolledStudentIds: string[],
  existingEntries: BulkZipEntry[] = [],
  approvedStudentIds?: string[]
): Promise<ParseZipResult> {
  const mergedEntries: BulkZipEntry[] = [...existingEntries];
  const existingFileNames = new Set(existingEntries.map((e) => e.fileName.toLowerCase()));
  const assignedStudentIds = new Set<string>();

  // Track students already assigned in existing batch
  for (const e of existingEntries) {
    if (e.status === 'matched' && e.matchedStudentId) {
      assignedStudentIds.add(e.matchedStudentId);
    }
  }

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    // 1. Handle ZIP archive
    if (lowerName.endsWith('.zip')) {
      const zipRes = await parseAndMatchCertificateZip(
        file,
        students,
        existingWorkshopCertificates,
        enrolledStudentIds,
        approvedStudentIds
      );

      if (!zipRes.success) {
        mergedEntries.push({
          id: `err-zip-${Date.now()}`,
          fileName: file.name,
          cleanName: file.name,
          fileBlob: file,
          fileSize: file.size,
          matchedStudentId: null,
          matchedStudentName: null,
          status: 'failed',
          confidence: 0,
          errorMessage: zipRes.error || 'Failed to extract ZIP archive.',
          potentialMatches: [],
        });
        continue;
      }

      for (const zipItem of zipRes.entries) {
        if (!existingFileNames.has(zipItem.fileName.toLowerCase())) {
          existingFileNames.add(zipItem.fileName.toLowerCase());
          mergedEntries.push(zipItem);
        }
      }
      continue;
    }

    // 2. Handle PDF file
    if (lowerName.endsWith('.pdf')) {
      if (file.size > MAX_SINGLE_PDF_SIZE) {
        mergedEntries.push({
          id: `err-size-${Date.now()}`,
          fileName: file.name,
          cleanName: file.name,
          fileBlob: file,
          fileSize: file.size,
          matchedStudentId: null,
          matchedStudentName: null,
          status: 'failed',
          confidence: 0,
          errorMessage: `File exceeds maximum single PDF limit of 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          potentialMatches: [],
        });
        continue;
      }

      if (existingFileNames.has(lowerName)) {
        // Prevent duplicate file upload in same batch
        continue;
      }

      existingFileNames.add(lowerName);
      const singleItem = matchSinglePdfItem(
        file.name,
        file,
        students,
        existingWorkshopCertificates,
        assignedStudentIds,
        approvedStudentIds
      );
      mergedEntries.push(singleItem);
      continue;
    }

    // 3. Reject unsupported formats
    mergedEntries.push({
      id: `err-fmt-${Date.now()}`,
      fileName: file.name,
      cleanName: file.name,
      fileBlob: file,
      fileSize: file.size,
      matchedStudentId: null,
      matchedStudentName: null,
      status: 'failed',
      confidence: 0,
      errorMessage: 'Unsupported file format. Only .pdf and .zip files are allowed.',
      potentialMatches: [],
    });
  }

  const matchedCount = mergedEntries.filter((e) => e.status === 'matched').length;
  const suggestedCount = mergedEntries.filter((e) => e.status === 'suggested').length;
  const ambiguousCount = mergedEntries.filter((e) => e.status === 'ambiguous').length;
  const unmatchedCount = mergedEntries.filter((e) => e.status === 'unmatched').length;
  const duplicateCount = mergedEntries.filter((e) => e.status === 'duplicate').length;

  return {
    success: true,
    entries: mergedEntries,
    totalFiles: mergedEntries.length,
    matchedCount,
    suggestedCount,
    ambiguousCount,
    unmatchedCount,
    duplicateCount,
  };
}

