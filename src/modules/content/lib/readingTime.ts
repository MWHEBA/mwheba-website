/**
 * Estimates reading time in minutes for bilingual text (Arabic and English).
 * Assumes an average reading speed of 180 words per minute.
 */
export function calculateReadingTime(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') return 1;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  return Math.max(1, Math.ceil(words.length / 180));
}
