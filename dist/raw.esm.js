/*!
 * PixSqueeze.js v1.4.1
 * https://pixsqueeze.alosha.dev/demo
 *
 * Copyright 2018-present Eduardo Silva Navarrete
 * Released under the MIT license
 *
 * Date: 2026-07-09T14:52:42.316Z
 */
/**
 * Camera RAW client-side utilities
 *
 * Detects camera RAW files (DNG, CR2, CR3, NEF, ARW, RAF, RW2, PEF, ORF …)
 * and converts them via the server-side endpoint before passing the result to
 * PixSqueeze.js.
 *
 * Supported formats (server converts all of these to JPEG via sharp/libvips):
 *   - DNG  — Adobe / Apple ProRAW (iOS)
 *   - CR2 / CR3 — Canon
 *   - NEF  — Nikon
 *   - ARW  — Sony
 *   - RAF  — Fujifilm
 *   - RW2  — Panasonic
 *   - PEF  — Pentax
 *   - ORF  — Olympus
 *   - SRW  — Samsung
 *   - 3FR / DCR / KDC / MRW / NRW / RWL / X3F — others
 *
 * Usage:
 *   import { isRawFile, convertRawOnServer } from './raw.js';
 *
 *   async function handleFile(file) {
 *     if (await isRawFile(file)) {
 *       file = await convertRawOnServer(file);
 *     }
 *     new PixSqueeze(file, options);
 *   }
 */

// ─── Detection ───────────────────────────────────────────────────────────────

const RAW_MIME_RE = /^image\/(x-adobe-dng|x-canon-cr[23]|x-nikon-nef|x-sony-arw|x-fuji-raf|x-panasonic-rw2|x-pentax-pef|x-olympus-orf|x-samsung-srw)/i;
const RAW_EXT_RE = /\.(dng|cr2|cr3|nef|arw|raf|rw2|pef|orf|srw|3fr|dcr|kdc|mrw|nrw|rwl|x3f)$/i;

/**
 * Determine whether a File/Blob is a camera RAW image.
 *
 * Checks MIME type and file extension first (most reliable).  If neither is
 * present, falls back to magic-byte sniffing:
 *   - Fujifilm RAF: "FUJIFILM" ASCII at offset 0
 *   - Panasonic RW2: II U\0 (0x49 0x49 0x55 0x00) at offset 0
 *   Note: DNG/CR2/NEF/ARW share TIFF magic bytes — they are indistinguishable
 *   from regular TIFFs without an extension, so extension detection is
 *   preferred for those formats.
 *
 * @param {File|Blob} file - The file to inspect.
 * @returns {Promise<boolean>} Resolves to `true` if the file is a camera RAW image.
 */
async function isRawFile(file) {
  if (RAW_MIME_RE.test(file.type)) return true;
  if (RAW_EXT_RE.test(file.name || '')) return true;

  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const b = new Uint8Array(buffer);

    // Fujifilm RAF — "FUJIFILM"
    const raf = String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
    if (raf === 'FUJIFILM') return true;

    // Panasonic RW2 — II U\0
    if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x55 && b[3] === 0x00) return true;

    return false;
  } catch (e) {
    return false;
  }
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Upload a camera RAW file to the server conversion endpoint and get back a
 * standard JPEG File object ready to pass into PixSqueeze.js.
 *
 * @param {File|Blob} file - The RAW file to convert.
 * @param {string} [endpoint='/api/convert/raw'] - Override the server URL if needed.
 * @returns {Promise<File>} A JPEG File with the same base name as the original.
 * @throws {Error} If the network request fails or the server returns an error.
 */
async function convertRawOnServer(file, endpoint = '/api/convert/raw') {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(endpoint, { method: 'POST', body: form });

  if (!res.ok) {
    let message = `Server responded ${res.status}`;
    try {
      const json = await res.json();
      if (json.error) message = json.error;
    } catch (e) { /* response was not JSON */ }
    throw new Error(`RAW conversion failed: ${message}`);
  }

  const blob = await res.blob();
  const serverName = res.headers.get('X-Original-Name');
  const originalName = file.name || 'image.dng';
  const outputName = serverName || originalName.replace(/\.(dng|cr2|cr3|nef|arw|raf|rw2|pef|orf|srw|3fr|dcr|kdc|mrw|nrw|rwl|x3f)$/i, '.jpg');

  return new File([blob], outputName, { type: 'image/jpeg' });
}

export { convertRawOnServer, isRawFile };
