/**
 * HEIC client-side utilities
 *
 * These helpers detect HEIC/HEIF files and convert them via the server-side
 * endpoint before passing the result to Compressor.js.  No WASM, no large
 * dependencies — the heavy decoding work is done on the server using Sharp.
 *
 * Usage:
 *   import { isHeicFile, convertHeicOnServer } from './heic.js';
 *
 *   async function handleFile(file) {
 *     if (await isHeicFile(file)) {
 *       file = await convertHeicOnServer(file);
 *     }
 *     new Compressor(file, options);
 *   }
 */

// ─── Detection ───────────────────────────────────────────────────────────────

const HEIC_MIME_RE = /^image\/hei[cf]/i;

/**
 * Determine whether a File/Blob is HEIC/HEIF.
 *
 * iOS devices often set `file.type` to an empty string when sharing HEIC photos
 * from the Photos app, so we fall back to reading the first 12 bytes and
 * checking the ISO Base Media File Format `ftyp` box header.
 *
 * @param {File|Blob} file
 * @returns {Promise<boolean>}
 */
export async function isHeicFile(file) {
  if (HEIC_MIME_RE.test(file.type)) return true;

  // Only sniff bytes when the MIME type is absent or ambiguous
  if (file.type && !file.type.startsWith('image/')) return false;

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return ftyp === 'ftyp' && /^hei[cfxs]|^hevc|^mif1|^msf1/.test(brand);
  } catch {
    return false;
  }
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Upload a HEIC/HEIF file to the server conversion endpoint and get back a
 * standard JPEG File object ready to pass into Compressor.js.
 *
 * @param {File|Blob} file - The HEIC file to convert.
 * @param {string} [endpoint='/api/convert/heic'] - Override the server URL if needed.
 * @returns {Promise<File>} A JPEG File with the same base name as the original.
 * @throws {Error} If the network request fails or the server returns an error.
 */
export async function convertHeicOnServer(file, endpoint = '/api/convert/heic') {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(endpoint, { method: 'POST', body: form });

  if (!res.ok) {
    let message = `Server responded ${res.status}`;
    try {
      const json = await res.json();
      if (json.error) message = json.error;
    } catch { /* response was not JSON */ }
    throw new Error(`HEIC conversion failed: ${message}`);
  }

  const blob = await res.blob();

  // Derive the output filename — use the header the server sets, or fall back
  // to replacing the extension on the original name.
  const serverName = res.headers.get('X-Original-Name');
  const originalName = file.name || 'image.heic';
  const outputName = serverName || originalName.replace(/\.heic$/i, '.jpg');

  return new File([blob], outputName, { type: 'image/jpeg' });
}
