'use strict';

const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const sharp = require('sharp');

// ─── sharp concurrency ────────────────────────────────────────────────────────

const CPU_COUNT = os.cpus().length;

// Each sharp pipeline runs libvips on CPU_COUNT threads by default.
// Cap to half the CPUs so concurrent conversions and the HEIC worker still
// have cores available, and Node.js event-loop latency stays low.
const SHARP_THREADS = Math.max(1, Math.ceil(CPU_COUNT / 2));
sharp.concurrency(SHARP_THREADS);

// Allow at most SHARP_THREADS pipelines to run simultaneously.
// Requests beyond this limit queue here instead of all contending for CPU at once.
class Semaphore {
  constructor(limit) {
    this._limit = limit;
    this._active = 0;
    this._queue = [];
  }

  acquire() {
    return new Promise((resolve) => {
      if (this._active < this._limit) {
        this._active += 1;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    this._active -= 1;
    if (this._queue.length > 0) {
      this._active += 1;
      this._queue.shift()();
    }
  }
}

const sharpSem = new Semaphore(SHARP_THREADS);

const app = express();

// Gzip/brotli for static assets (HTML/CSS/JS) and JSON error responses.
// JPEG binary responses are excluded automatically (already compressed).
app.use(compression());

// ─── CORS ────────────────────────────────────────────────────────────────────

// The client helpers (convertHeicOnServer et al.) default to a relative
// `/api/convert/...` URL, but nothing stops a consumer deploying this server
// on its own origin and calling it from a different one. Without CORS those
// cross-origin requests fail outright; without exposing X-Original-Name,
// `fetch` responses can be read but that specific header comes back as null.
//
// Defaults to "*" so the demo and any first deploy work with zero config.
// Pin this to your real origin(s) in production, e.g.
// CORS_ORIGIN=https://example.com or a comma-separated list.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: CORS_ORIGIN.includes(',') ? CORS_ORIGIN.split(',').map((o) => o.trim()) : CORS_ORIGIN,
  exposedHeaders: ['X-Original-Name'],
}));

// ─── Rate limiting ───────────────────────────────────────────────────────────

// Tuned for image conversion (CPU/memory-heavy per request), not general API
// traffic — a much lower ceiling than a typical JSON API limiter would use.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;

app.use('/api/convert', rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many conversion requests. Please try again later.' },
}));

// ─── HEIC worker pool ────────────────────────────────────────────────────────

/**
 * Decode HEIC files to a lossless PNG intermediate in a fixed pool of worker
 * threads so the main event loop is not blocked during the CPU-intensive
 * WASM decode. The caller is responsible for re-encoding the PNG to the
 * desired output format (see `sharpToJpeg`).
 *
 * Sized like SHARP_THREADS rather than spawned per-request: spawning a new
 * worker (and its own WASM instance) per request is wasteful under sustained
 * traffic, and gives an attacker an easy way to spin up unbounded threads.
 */
const HEIC_WORKER_TIMEOUT_MS = Number(process.env.HEIC_WORKER_TIMEOUT_MS) || 30 * 1000;

class HeicWorkerPool {
  constructor(size) {
    this._idle = [];
    this._queue = [];
    for (let i = 0; i < size; i += 1) this._idle.push(this._spawn());
  }

  _spawn() {
    const worker = new Worker(path.join(__dirname, 'heic-worker.js'));
    // Idle pool workers must not keep the process alive on their own — the
    // HTTP server (app.listen()) is what does that. Without this, a process
    // that requires this module never exits naturally once the pool is warm.
    worker.unref();
    return worker;
  }

  // A worker that errored or hung can't be trusted to pick up further jobs —
  // replace it so the pool stays at full size.
  _replace(worker) {
    worker.removeAllListeners();
    worker.terminate();
    this._idle.push(this._spawn());
    this._dispatch();
  }

  _dispatch() {
    if (this._queue.length === 0 || this._idle.length === 0) return;
    const worker = this._idle.shift();
    const { buffer, resolve, reject } = this._queue.shift();
    this._run(worker, buffer, resolve, reject);
  }

  _run(worker, buffer, resolve, reject) {
    let settled = false;

    const onMessage = ({ ok, result, error }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeListener('error', onError);
      this._idle.push(worker);
      this._dispatch();
      if (ok) resolve(result);
      else reject(new Error(error));
    };

    const onError = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeListener('message', onMessage);
      reject(err);
      this._replace(worker);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.removeListener('message', onMessage);
      worker.removeListener('error', onError);
      reject(new Error('HEIC decode timed out'));
      // The WASM decode can't be cancelled mid-flight — the worker is stuck
      // running it, so it must be killed rather than returned to the pool.
      this._replace(worker);
    }, HEIC_WORKER_TIMEOUT_MS);

    worker.once('message', onMessage);
    worker.once('error', onError);

    // Zero-copy transfer is only safe when this Buffer exclusively owns its
    // backing ArrayBuffer. Node serves allocations under 4 KB (half of
    // Buffer.poolSize) from a shared 8 KB pool slab — multer's memoryStorage
    // (via concat-stream) builds the upload buffer with Buffer.concat, so a
    // small upload's buffer.buffer can be that shared slab. Transferring it
    // would detach memory other, unrelated small Buffers may still reference.
    // Confirmed empirically: Buffer.concat on <4 KB input yields a nonzero
    // byteOffset into an 8192-byte pool ArrayBuffer; >=4 KB input always gets
    // its own dedicated ArrayBuffer.
    const ownsBuffer = buffer.byteOffset === 0 && buffer.buffer.byteLength === buffer.length;
    if (ownsBuffer) {
      worker.postMessage({ buffer }, [buffer.buffer]);
    } else {
      worker.postMessage({ buffer });
    }
  }

  convert(buffer) {
    return new Promise((resolve, reject) => {
      if (this._idle.length > 0) {
        this._run(this._idle.shift(), buffer, resolve, reject);
      } else {
        this._queue.push({ buffer, resolve, reject });
      }
    });
  }
}

const heicPool = new HeicWorkerPool(SHARP_THREADS);

/**
 * @param {Buffer} buffer - Raw HEIC file bytes.
 * @returns {Promise<Buffer>} Resolved with the decoded PNG buffer.
 */
function heicConvertInWorker(buffer) {
  return heicPool.convert(buffer);
}

// Store uploads in memory — no temp files on disk.
// Ceiling lowered from a prior 200 MB default: professional TIFFs/RAW files
// can be large, but memory-based multer buffers the whole body before any
// limit-checking logic runs, so raise this via MAX_UPLOAD_MB only as far as
// your deployment's memory budget (× UPLOAD_CONCURRENCY, see below) allows.
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 100;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// Multer buffers an entire upload into memory before any route code — and
// therefore sharpSem, which only bounds concurrent sharp *pipelines* — ever
// runs. A handful of concurrent near-ceiling uploads can exhaust the heap
// before that limiter applies. Cap how many requests may hold an upload
// buffer at once (from parsing through response) independently of that.
const UPLOAD_CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY) || 6;
const uploadSem = new Semaphore(UPLOAD_CONCURRENCY);

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

// ─── TIFF / RAW detection ────────────────────────────────────────────────────

const TIFF_MIME_RE = /^image\/tiff/i;
const RAW_MIME_RE = /^image\/(x-adobe-dng|x-canon-cr[23]|x-nikon-nef|x-sony-arw|x-fuji-raf|x-panasonic-rw2|x-pentax-pef|x-olympus-orf|x-samsung-srw)/i;
const RAW_EXT_RE = /\.(dng|cr2|cr3|nef|arw|raf|rw2|pef|orf|srw|3fr|dcr|kdc|mrw|nrw|rwl|x3f)$/i;
const TIFF_EXT_RE = /\.tiff?$/i;

/**
 * Detect a TIFF file by magic bytes.
 * Little-endian: II*\0 (0x49 0x49 0x2A 0x00)
 * Big-endian:    MM\0* (0x4D 0x4D 0x00 0x2A)
 *
 * Trust-boundary note: the /tiff and /raw routes below accept a file if
 * *either* its magic bytes match *or* (as a fallback) its extension does, so
 * an attacker can still get arbitrary bytes in front of sharp by naming a
 * file `x.tiff`/`x.dng`/etc. This is accepted rather than closed off: sharp
 * (libvips) is the actual trust boundary here, not this pre-check. It's a
 * decoder whose entire job is parsing untrusted image bytes from the web, so
 * a magic-byte match doesn't meaningfully reduce risk over a deeper malformed
 * payload — the extension fallback exists because some browsers/OSes send a
 * generic `application/octet-stream` MIME type for these formats, and without
 * it those uploads would be rejected outright. A worst case (a parser bug in
 * libvips) exists whether or not this check is tightened.
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
 * Shared sharp → JPEG converter for HEIC, TIFF and RAW formats.
 * `.rotate()` applies any embedded orientation metadata automatically.
 */
async function sharpToJpeg(buffer, quality = 95) {
  await sharpSem.acquire();
  try {
    return await sharp(buffer).rotate().jpeg({ quality }).toBuffer();
  } finally {
    sharpSem.release();
  }
}

/**
 * Reduce a user-supplied filename to a safe printable-ASCII subset before it
 * goes into the X-Original-Name response header.
 *
 * This is not header-injection prevention in the classic sense — Node's
 * `res.set`/`setHeader` already throws ERR_INVALID_CHAR on a value containing
 * CR or LF, so a raw "\r\nX-Injected: x" filename can't smuggle a header.
 * What it does prevent: that throw turning a successful conversion into an
 * error response, and non-ASCII bytes (e.g. "café.heic") coming back mangled
 * because HTTP header values are transmitted as Latin-1, not UTF-8 — verified
 * empirically, `café.jpg` round-trips as `cafÃ©.jpg`. RFC 5987 encoding would
 * preserve the original name losslessly, but the client helpers
 * (src/heic.js, src/tiff.js, src/raw.js) read this header as a plain string
 * and use it directly as the output filename, so an encoded value would leak
 * through unparsed — plain ASCII keeps that contract intact.
 */
function sanitizeHeaderFilename(name) {
  const safe = name.replace(/[^\x20-\x7E]/g, '_').trim();
  return safe || 'file';
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
  await uploadSem.acquire();
  try {
    try {
      await runUpload(req, res);
    } catch (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum upload size is ${MAX_UPLOAD_MB} MB.` });
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
      const pngBuffer = await heicConvertInWorker(buffer);
      const outputBuffer = await sharpToJpeg(pngBuffer);

      const outputName = sanitizeHeaderFilename((originalname || 'image.heic').replace(/\.heic$/i, '.jpg'));

      res.set({ 'Content-Type': 'image/jpeg', 'X-Original-Name': outputName, 'Content-Length': outputBuffer.byteLength });
      return res.send(outputBuffer);
    } catch (err) {
      console.error('[HEIC convert] error:', err.message);
      return res.status(422).json({ error: `Failed to convert HEIC image: ${err.message}` });
    }
  } finally {
    uploadSem.release();
  }
});

/**
 * POST /api/convert/tiff
 *
 * Accepts a TIFF image (MIME type image/tiff or TIFF magic bytes) and returns
 * a JPEG at quality 95.
 */
app.post('/api/convert/tiff', async (req, res) => {
  await uploadSem.acquire();
  try {
    try {
      await runUpload(req, res);
    } catch (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum upload size is ${MAX_UPLOAD_MB} MB.` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const isTiffMime = TIFF_MIME_RE.test(mimetype);
    // Extension is a fallback signal only when MIME and magic bytes both miss
    // (e.g. a browser sending application/octet-stream) — see the trust-
    // boundary note above isTiffBuffer/isRafBuffer/isRw2Buffer regarding why
    // that's acceptable here.
    const isTiffExt = TIFF_EXT_RE.test(originalname || '');

    if (!isTiffMime && !isTiffExt && !isTiffBuffer(buffer)) {
      return res.status(415).json({
        error: 'Unsupported file type. Only TIFF images are accepted by this endpoint.',
      });
    }

    try {
      const outputBuffer = await sharpToJpeg(buffer);
      const outputName = sanitizeHeaderFilename((originalname || 'image.tiff').replace(/\.tiff?$/i, '.jpg'));

      res.set({ 'Content-Type': 'image/jpeg', 'X-Original-Name': outputName, 'Content-Length': outputBuffer.byteLength });
      return res.send(outputBuffer);
    } catch (err) {
      console.error('[TIFF convert] error:', err.message);
      return res.status(422).json({ error: `Failed to convert TIFF image: ${err.message}` });
    }
  } finally {
    uploadSem.release();
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
  await uploadSem.acquire();
  try {
    try {
      await runUpload(req, res);
    } catch (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum upload size is ${MAX_UPLOAD_MB} MB.` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const isRawMime = RAW_MIME_RE.test(mimetype);
    // DNG/CR2/NEF/ARW/PEF/ORF are TIFF-container RAW formats but aren't magic-
    // byte-checked here (isTiffBuffer is only called from the /tiff route), so
    // for those specific extensions this falls through to extension alone —
    // see the trust-boundary note above isTiffBuffer.
    const isRawExt = RAW_EXT_RE.test(originalname || '');

    if (!isRawMime && !isRawExt && !isRafBuffer(buffer) && !isRw2Buffer(buffer)) {
      return res.status(415).json({
        error: 'Unsupported file type. Only camera RAW images (DNG, CR2, NEF, ARW, RAF, RW2 …) are accepted.',
      });
    }

    try {
      const outputBuffer = await sharpToJpeg(buffer);
      const outputName = sanitizeHeaderFilename((originalname || 'image.dng').replace(RAW_EXT_RE, '.jpg'));

      res.set({ 'Content-Type': 'image/jpeg', 'X-Original-Name': outputName, 'Content-Length': outputBuffer.byteLength });
      return res.send(outputBuffer);
    } catch (err) {
      console.error('[RAW convert] error:', err.message);
      return res.status(422).json({ error: `Failed to convert RAW image: ${err.message}` });
    }
  } finally {
    uploadSem.release();
  }
});

// ─── Static demo ─────────────────────────────────────────────────────────────

// Serves docs/ (the public demo page + assets) so you can open
// http://localhost:3000 and test end-to-end. No index restriction is applied
// because everything under docs/ is meant to be public — it's the same
// content a static host would serve, not user data.
// Static assets (JS/CSS/HTML) are cached for 1 hour in the browser; this avoids
// re-fetching compressor.js on every demo reload.
app.use(express.static(path.join(__dirname, '..', 'docs'), {
  maxAge: '1h',
  etag: true,
}));

// Exposed for direct unit testing — see server/test/security.test.js.
app.sanitizeHeaderFilename = sanitizeHeaderFilename;

module.exports = app;
