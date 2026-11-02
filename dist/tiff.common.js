/*!
 * PixSqueeze.js v1.5.0
 * https://pixsqueeze.alosha.dev/demo
 *
 * Copyright 2018-present Eduardo Silva Navarrete
 * Released under the MIT license
 *
 * Date: 2026-11-02T13:02:53.886Z
 */
'use strict';

/** Shared transport for the three optional server conversion helpers. */
async function convert(file, endpoint, format, options = {}) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal: options.signal,
    headers: options.headers,
    credentials: options.credentials,
  });

  if (!res.ok) {
    let message = `Server responded ${res.status}`;
    try {
      const json = await res.json();
      if (json.error) message = json.error;
    } catch (e) { /* response was not JSON */ }
    throw new Error(`${format.toUpperCase()} conversion failed: ${message}`);
  }

  const blob = await res.blob();
  const originalName = file.name || `image.${format}`;
  const outputName = res.headers.get('X-Original-Name') || `${originalName.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], outputName, { type: 'image/jpeg' });
}

/**
 * TIFF client-side utilities
 *
 * Detects TIFF files and converts them via the server-side endpoint before
 * passing the result to PixSqueeze.js.
 *
 * Usage:
 *   import { isTiffFile, convertTiffOnServer } from '@alosha/pixsqueeze/tiff';
 *
 *   async function handleFile(file) {
 *     if (await isTiffFile(file)) {
 *       file = await convertTiffOnServer(file);
 *     }
 *     new PixSqueeze(file, options);
 *   }
 */

// ─── Detection ───────────────────────────────────────────────────────────────

const TIFF_MIME_RE = /^image\/tiff/i;
const TIFF_EXT_RE = /\.tiff?$/i;

/**
 * Determine whether a File/Blob is a TIFF image.
 *
 * Checks the MIME type and file extension first; falls back to reading the
 * first 4 bytes and checking the TIFF magic number:
 *   Little-endian: II*\0  (0x49 0x49 0x2A 0x00)
 *   Big-endian:    MM\0*  (0x4D 0x4D 0x00 0x2A)
 *
 * @param {File|Blob} file - The file to inspect.
 * @returns {Promise<boolean>} Resolves to `true` if the file matches the expected format.
 */
async function isTiffFile(file) {
  if (TIFF_MIME_RE.test(file.type)) return true;
  if (TIFF_EXT_RE.test(file.name || '')) return true;

  if (file.type && !file.type.startsWith('image/')) return false;

  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const b = new Uint8Array(buffer);
    return (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00)
        || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A);
  } catch (e) {
    return false;
  }
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Upload a TIFF file to the server conversion endpoint and get back a
 * standard JPEG File object ready to pass into PixSqueeze.js.
 * The bundled endpoint returns the first page of multi-page TIFF input.
 *
 * @param {File|Blob} file - The TIFF file to convert.
 * @param {string} [endpoint='/api/convert/tiff'] - Override the server URL if needed.
 * @param {Object} [options={}] - Fetch request options; no timeout is added here.
 * @param {AbortSignal} [options.signal] - Cancel the upload or response read.
 * @param {HeadersInit} [options.headers] - Request headers; omit multipart Content-Type.
 * @param {RequestCredentials} [options.credentials] - Fetch credentials policy.
 * @returns {Promise<File>} A JPEG File with the same base name as the original.
 * @throws {Error} If the network request fails or the server returns an error.
 */
async function convertTiffOnServer(file, endpoint = '/api/convert/tiff', options = {}) {
  return convert(file, endpoint, 'tiff', options);
}

exports.convertTiffOnServer = convertTiffOnServer;
exports.isTiffFile = isTiffFile;
