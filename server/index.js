'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const heicConvert = require('heic-convert');

const app = express();
const PORT = process.env.PORT || 3000;

// Store uploads in memory — no temp files on disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

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
app.post('/api/convert/heic', upload.single('file'), async (req, res) => {
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
    const outputBuffer = await heicConvert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.95,
    });

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

// ─── Static demo ─────────────────────────────────────────────────────────────

// Serve the docs/ demo so you can open http://localhost:3000 to test end-to-end
app.use(express.static(path.join(__dirname, '..', 'docs')));

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Compressor.js demo server running at http://localhost:${PORT}`);
  console.log(`HEIC conversion endpoint: POST http://localhost:${PORT}/api/convert/heic`);
});
