import convert from './convert';

/**
 * HEIC client-side utilities
 *
 * These helpers detect HEIC/HEIF files and convert them via the server-side
 * endpoint before passing the result to PixSqueeze.js.  No WASM, no large
 * dependencies in the browser — the bundled server decodes HEIC in a worker
 * with heic-convert and uses Sharp to encode the intermediate PNG as JPEG.
 *
 * Usage:
 *   import { isHeicFile, convertHeicOnServer } from '@alosha/pixsqueeze/heic';
 *
 *   async function handleFile(file) {
 *     if (await isHeicFile(file)) {
 *       file = await convertHeicOnServer(file);
 *     }
 *     new PixSqueeze(file, options);
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
 * @param {File|Blob} file - The file to inspect.
 * @returns {Promise<boolean>} Resolves to `true` if the file matches the expected format.
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
  } catch (e) {
    return false;
  }
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Upload a HEIC/HEIF file to the server conversion endpoint and get back a
 * standard JPEG File object ready to pass into PixSqueeze.js.
 *
 * @param {File|Blob} file - The HEIC file to convert.
 * @param {string} [endpoint='/api/convert/heic'] - Override the server URL if needed.
 * @param {Object} [options={}] - Fetch request options; no timeout is added here.
 * @param {AbortSignal} [options.signal] - Cancel the upload or response read.
 * @param {HeadersInit} [options.headers] - Request headers; omit multipart Content-Type.
 * @param {RequestCredentials} [options.credentials] - Fetch credentials policy.
 * @returns {Promise<File>} A JPEG File with the same base name as the original.
 * @throws {Error} If the network request fails or the server returns an error.
 */
export async function convertHeicOnServer(file, endpoint = '/api/convert/heic', options = {}) {
  return convert(file, endpoint, 'heic', options);
}
