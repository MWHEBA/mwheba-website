/**
 * Safely serialize data into JSON string suitable for embedding inside an HTML <script> tag.
 * Replaces dangerous HTML characters (<, >, &, \u2028, \u2029) with their unicode escape sequences
 * to completely eliminate HTML injection or script breakout (e.g. `</script>`).
 */
export function safeJsonLdReplacer(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
