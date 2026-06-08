'use strict';

const path = require('path');
const { Worker } = require('worker_threads');
const express = require('express');
const compression = require('compression');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip/brotli for static assets (HTML/CSS/JS) and JSON error responses.
// JPEG binary responses are excluded automatically (already compressed).
app.use(compression());

// ─── HEIC worker pool ────────────────────────────────────────────────────────

/**
 * Run HEIC → JPEG conversion in a dedicated worker thread so the
 * main event loop is not blocked during the CPU-intensive WASM decode.
 *
 * A new Worker is created per request. For a production deployment with
 * sustained traffic a fixed-size thread pool would be more efficient, but
 * for a local / small-scale server this is the simplest correct approach.
 *
 * @param {Buffer} buffer  - Raw HEIC file bytes.
 * @param {number} quality - JPEG quality (0–1).
 * @returns {Promise<Buffer>} Resolved with the JPEG output buffer.
 */
function heicConvertInWorker(buffer, quality) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'heic-worker.js'));

    worker.once('message', ({ ok, result, error }) => {
      if (ok) resolve(result);
      else reject(new Error(error));
    });

    worker.once('error', reject);

    // Transfer the buffer's underlying ArrayBuffer to avoid copying it.
    worker.postMessage({ buffer, quality }, [buffer.buffer]);
  });
}

// Store uploads in memory — no temp files on disk
// 200 MB ceiling: uncompressed professional TIFFs and multi-frame RAW files can
// easily exceed 50 MB. Multer raises a LIMIT_FILE_SIZE error (→ 413) if exceeded.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

/**
 * Run `upload.single('file')` as a Promise so that multer errors (including
 * LIMIT_FILE_SIZE, which fires from a stream event handler) are caught by the
 * surrounding try/catch in each route instead of crashing the process.
 */
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── HEIC detection ──────────────────────────────────────────────────────────

/**
 * Detect a HEIC/HEIF file by inspecting its ISO Base Media File Format header.
 * The `ftyp` box lives at byte offset 4–7; the major brand at offset 8–11.
 * iOS sometimes reports an empty MIME type, so we cannot rely on `mimetype` alone.
 *
 * @param {Buffer} buffer - File buffer (only the first 12 bytes are needed).
 * @returns {boolean}
 */
function isHeicBuffer(buffer) {
  if (buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString('ascii');
  const brand = buffer.slice(8, 12).toString('ascii');
  return ftyp === 'ftyp' && /^hei[cfxs]|^hevc|^mif1|^msf1/.test(brand);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/convert/heic
 *
 * Accepts a multipart upload with field name `file`.
 * Validates that the payload is a HEIC/HEIF image (by MIME type or magic bytes),
 * converts it to JPEG at quality 95, and streams the result back.
 *
 * Response headers:
 *   Content-Type: image/jpeg
 *   X-Original-Name: <original filename with .jpg extension>
 */
app.post('/api/convert/heic', async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum upload size is 200 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
  }

  const { buffer, mimetype, originalname } = req.file;
  const isHeicMime = /^image\/hei[cf]/i.test(mimetype);

  if (!isHeicMime && !isHeicBuffer(buffer)) {
    return res.status(415).json({
      error: 'Unsupported file type. Only HEIC/HEIF images are accepted by this endpoint.',
    });
  }

  try {
    const outputBuffer = await heicConvertInWorker(buffer, 0.95);

    const outputName = (originalname || 'image.heic').replace(/\.heic$/i, '.jpg');

    res.set('Content-Type', 'image/jpeg');
    res.set('X-Original-Name', outputName);
    res.set('Content-Length', outputBuffer.byteLength);
    return res.send(Buffer.from(outputBuffer));
  } catch (err) {
    console.error('[HEIC convert] error:', err.message);
    return res.status(422).json({ error: 'Failed to convert HEIC image: ' + err.message });
  }
});

// ─── TIFF / RAW detection ────────────────────────────────────────────────────

const TIFF_MIME_RE = /^image\/tiff/i;
const RAW_MIME_RE = /^image\/(x-adobe-dng|x-canon-cr[23]|x-nikon-nef|x-sony-arw|x-fuji-raf|x-panasonic-rw2|x-pentax-pef|x-olympus-orf|x-samsung-srw)/i;
const RAW_EXT_RE = /\.(dng|cr2|cr3|nef|arw|raf|rw2|pef|orf|srw|3fr|dcr|kdc|mrw|nrw|rwl|x3f)$/i;
const TIFF_EXT_RE = /\.tiff?$/i;

/**
 * Detect a TIFF file by magic bytes.
 * Little-endian: II*\0 (0x49 0x49 0x2A 0x00)
 * Big-endian:    MM\0* (0x4D 0x4D 0x00 0x2A)
 */
function isTiffBuffer(buffer) {
  if (buffer.length < 4) return false;
  return (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00)
      || (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A);
}

/**
 * Detect Fujifilm RAF by its fixed 8-byte ASCII signature "FUJIFILM".
 */
function isRafBuffer(buffer) {
  return buffer.length >= 8 && buffer.slice(0, 8).toString('ascii') === 'FUJIFILM';
}

/**
 * Detect Panasonic RW2 by its magic bytes: II U\0 (0x49 0x49 0x55 0x00).
 */
function isRw2Buffer(buffer) {
  return buffer.length >= 4
    && buffer[0] === 0x49 && buffer[1] === 0x49
    && buffer[2] === 0x55 && buffer[3] === 0x00;
}

/**
 * Shared sharp → JPEG converter for TIFF and RAW formats.
 * `.rotate()` applies any embedded orientation metadata automatically.
 */
async function sharpToJpeg(buffer) {
  return sharp(buffer).rotate().jpeg({ quality: 95 }).toBuffer();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/convert/tiff
 *
 * Accepts a TIFF image (MIME type image/tiff or TIFF magic bytes) and returns
 * a JPEG at quality 95.
 */
app.post('/api/convert/tiff', async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum upload size is 200 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
  }

  const { buffer, mimetype, originalname } = req.file;
  const isTiffMime = TIFF_MIME_RE.test(mimetype);
  const isTiffExt = TIFF_EXT_RE.test(originalname || '');

  if (!isTiffMime && !isTiffExt && !isTiffBuffer(buffer)) {
    return res.status(415).json({
      error: 'Unsupported file type. Only TIFF images are accepted by this endpoint.',
    });
  }

  try {
    const outputBuffer = await sharpToJpeg(buffer);
    const outputName = (originalname || 'image.tiff').replace(/\.tiff?$/i, '.jpg');

    res.set('Content-Type', 'image/jpeg');
    res.set('X-Original-Name', outputName);
    res.set('Content-Length', outputBuffer.byteLength);
    return res.send(outputBuffer);
  } catch (err) {
    console.error('[TIFF convert] error:', err.message);
    return res.status(422).json({ error: 'Failed to convert TIFF image: ' + err.message });
  }
});

/**
 * POST /api/convert/raw
 *
 * Accepts a camera RAW image (DNG, CR2, CR3, NEF, ARW, RAF, RW2, PEF, ORF …)
 * and returns a JPEG at quality 95.
 *
 * DNG / CR2 / NEF / ARW / PEF / ORF all use the TIFF container so they are
 * handled by libvips/sharp without additional codecs.  RAF and RW2 have their
 * own container formats and require the libvips build to include LibRaw; sharp
 * will return a 422 with a clear error message if they are not supported by
 * the installed binary.
 */
app.post('/api/convert/raw', async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum upload size is 200 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
  }

  const { buffer, mimetype, originalname } = req.file;
  const isRawMime = RAW_MIME_RE.test(mimetype);
  const isRawExt = RAW_EXT_RE.test(originalname || '');

  if (!isRawMime && !isRawExt && !isRafBuffer(buffer) && !isRw2Buffer(buffer)) {
    return res.status(415).json({
      error: 'Unsupported file type. Only camera RAW images (DNG, CR2, NEF, ARW, RAF, RW2 …) are accepted.',
    });
  }

  try {
    const outputBuffer = await sharpToJpeg(buffer);
    const outputName = (originalname || 'image.dng').replace(RAW_EXT_RE, '.jpg');

    res.set('Content-Type', 'image/jpeg');
    res.set('X-Original-Name', outputName);
    res.set('Content-Length', outputBuffer.byteLength);
    return res.send(outputBuffer);
  } catch (err) {
    console.error('[RAW convert] error:', err.message);
    return res.status(422).json({ error: 'Failed to convert RAW image: ' + err.message });
  }
});

// ─── Static demo ─────────────────────────────────────────────────────────────

// Serve the docs/ demo so you can open http://localhost:3000 to test end-to-end.
// Static assets (JS/CSS/HTML) are cached for 1 hour in the browser; this avoids
// re-fetching compressor.js on every demo reload.
app.use(express.static(path.join(__dirname, '..', 'docs'), {
  maxAge: '1h',
  etag: true,
}));

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Compressor.js demo server running at http://localhost:${PORT}`);
  console.log(`HEIC conversion endpoint: POST http://localhost:${PORT}/api/convert/heic`);
  console.log(`TIFF conversion endpoint: POST http://localhost:${PORT}/api/convert/tiff`);
  console.log(`RAW  conversion endpoint: POST http://localhost:${PORT}/api/convert/raw`);
});
