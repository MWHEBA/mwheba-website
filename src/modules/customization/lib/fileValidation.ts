import crypto from 'node:crypto';
import path from 'node:path';

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per Ticket B2B-03

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/pdf',
  'image/vnd.adobe.photoshop',
  'application/illustrator',
  'application/postscript',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface FileValidationResult {
  isValid: boolean;
  mimeType: AllowedMimeType;
  fileSize: number;
  originalFilename: string;
  sha256: string;
  error?: string;
}

/**
 * Strips path traversal and unsafe characters from filenames.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return `artwork_${Date.now()}.bin`;

  // Extract basename to prevent any directory traversal (../ or ..\)
  const basename = path.basename(rawName.trim().replace(/\\/g, '/'));

  // Separate extension from name
  const ext = path.extname(basename).toLowerCase();
  const nameWithoutExt = basename.slice(0, basename.length - ext.length);

  // Allow only alphanumeric, underscores, hyphens
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim().slice(0, 80);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);

  return `${safeName || 'artwork'}${safeExt || '.dat'}`;
}

/**
 * Checks for known executable headers to immediately trap disguised malware.
 */
function isExecutableHeader(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // DOS / Windows PE Header: MZ (0x4D 0x5A)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true;
  }

  // Linux ELF Header: 0x7F 'E' 'L' 'F'
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return true;
  }

  // Java Class Header: 0xCA 0xFE 0xBA 0xBE
  if (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe) {
    return true;
  }

  // Mach-O Binaries (macOS)
  const magic32 = buffer.readUInt32BE(0);
  if (magic32 === 0xfeedface || magic32 === 0xfeedfacf || magic32 === 0xcefaedfe || magic32 === 0xcffaedfe) {
    return true;
  }

  return false;
}

/**
 * Inspects SVG content for XSS vectors, scripts, inline event handlers, and XXE definitions.
 */
function validateAndSanitizeSvg(content: string): { isValid: boolean; error?: string } {
  // Must contain an <svg tag
  if (!/<svg[\s>]/i.test(content)) {
    return { isValid: false, error: 'Malformed SVG: Missing <svg> root element.' };
  }

  // XXE Defense: Disallow DOCTYPE ENTITY attacks
  if (/<!ENTITY/i.test(content) || /SYSTEM\s+["']/i.test(content)) {
    return { isValid: false, error: 'Malicious SVG: External entity declarations (XXE) are forbidden.' };
  }

  // XSS Defense: Disallow <script> tags
  if (/<script[\s>]/i.test(content) || /<\/script>/i.test(content)) {
    return { isValid: false, error: 'Malicious SVG: Embedded <script> tags are strictly forbidden.' };
  }

  // Disallow active executable tags: <foreignObject>, <iframe>, <embed>, <object>
  if (/<(foreignObject|iframe|embed|object)[\s>]/i.test(content)) {
    return { isValid: false, error: 'Malicious SVG: Embedded executable or foreign containers are forbidden.' };
  }

  // Disallow javascript: URLs in attributes (href, xlink:href, etc.)
  if (/href\s*=\s*["']?\s*javascript:/i.test(content)) {
    return { isValid: false, error: 'Malicious SVG: javascript: URLs in attributes are forbidden.' };
  }

  // Disallow inline DOM event handlers: onload, onerror, onclick, onmouseover, etc.
  if (/\son\w+\s*=/i.test(content)) {
    return { isValid: false, error: 'Malicious SVG: Inline DOM event handlers are forbidden.' };
  }

  return { isValid: true };
}

/**
 * Inspects buffer magic bytes and detects the genuine MIME type.
 */
export function detectMagicBytes(buffer: Buffer): {
  detectedMime: AllowedMimeType | null;
  isMaliciousExecutable: boolean;
  error?: string;
} {
  if (isExecutableHeader(buffer)) {
    return {
      detectedMime: null,
      isMaliciousExecutable: true,
      error: 'Disguised executable binary detected (malware protection trigger).',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { detectedMime: 'image/png', isMaliciousExecutable: false };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { detectedMime: 'image/jpeg', isMaliciousExecutable: false };
  }

  // PDF & Adobe Illustrator (.ai modern format): %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { detectedMime: 'application/pdf', isMaliciousExecutable: false };
  }

  // Photoshop (.psd): '8BPS' (0x38 0x42 0x50 0x53)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x38 &&
    buffer[1] === 0x42 &&
    buffer[2] === 0x50 &&
    buffer[3] === 0x53
  ) {
    return { detectedMime: 'image/vnd.adobe.photoshop', isMaliciousExecutable: false };
  }

  // PostScript / Illustrator legacy EPS: '%!PS' (0x25 0x21 0x50 0x53) or DOS EPS binary header
  if (
    (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x21 && buffer[2] === 0x50 && buffer[3] === 0x53) ||
    (buffer.length >= 4 && buffer[0] === 0xc5 && buffer[1] === 0xd0 && buffer[2] === 0xd3 && buffer[3] === 0xc6)
  ) {
    return { detectedMime: 'application/postscript', isMaliciousExecutable: false };
  }

  // SVG: Inspect text within the first 4KB
  const headerSample = buffer.slice(0, 4096).toString('utf8');
  if (headerSample.includes('<svg') || (headerSample.includes('<?xml') && headerSample.includes('<svg'))) {
    const fullText = buffer.toString('utf8');
    const svgCheck = validateAndSanitizeSvg(fullText);
    if (!svgCheck.isValid) {
      return {
        detectedMime: null,
        isMaliciousExecutable: false,
        error: svgCheck.error,
      };
    }
    return { detectedMime: 'image/svg+xml', isMaliciousExecutable: false };
  }

  return { detectedMime: null, isMaliciousExecutable: false, error: 'Unsupported file format signature.' };
}

/**
 * Validates an uploaded artwork buffer against size, mime, and signature rules.
 */
export function validateArtworkFile(
  buffer: Buffer,
  declaredFilename: string,
  declaredMime?: string
): FileValidationResult {
  const safeFilename = sanitizeFilename(declaredFilename);
  const fileSize = buffer.length;

  if (fileSize <= 0) {
    return {
      isValid: false,
      mimeType: 'image/png',
      fileSize: 0,
      originalFilename: safeFilename,
      sha256: '',
      error: 'Empty file rejected.',
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return {
      isValid: false,
      mimeType: 'image/png',
      fileSize,
      originalFilename: safeFilename,
      sha256: '',
      error: `File size (${(fileSize / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum allowed 50MB.`,
    };
  }

  const { detectedMime, isMaliciousExecutable, error: detectionError } = detectMagicBytes(buffer);

  if (isMaliciousExecutable) {
    return {
      isValid: false,
      mimeType: 'image/png',
      fileSize,
      originalFilename: safeFilename,
      sha256: '',
      error: 'Malware defense: Disguised executable binary detected (malware protection trigger).',
    };
  }

  if (!detectedMime) {
    return {
      isValid: false,
      mimeType: 'image/png',
      fileSize,
      originalFilename: safeFilename,
      sha256: '',
      error: detectionError || 'File signature does not match any allowed artwork format (PNG, JPEG, SVG, PDF, PSD, AI/EPS).',
    };
  }

  // Cross-verify extension with detected mime
  const ext = path.extname(safeFilename).toLowerCase();
  const extMimeMap: Record<string, AllowedMimeType[]> = {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.svg': ['image/svg+xml'],
    '.pdf': ['application/pdf'],
    '.ai': ['application/pdf', 'application/postscript', 'application/illustrator'],
    '.psd': ['image/vnd.adobe.photoshop'],
    '.eps': ['application/postscript', 'application/illustrator'],
  };

  if (ext && extMimeMap[ext] && !extMimeMap[ext].includes(detectedMime)) {
    return {
      isValid: false,
      mimeType: detectedMime,
      fileSize,
      originalFilename: safeFilename,
      sha256: '',
      error: `MIME type spoofing detected: File extension '${ext}' does not match content signature '${detectedMime}'.`,
    };
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    isValid: true,
    mimeType: detectedMime,
    fileSize,
    originalFilename: safeFilename,
    sha256,
  };
}
