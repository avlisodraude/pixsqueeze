'use strict';

/**
 * Worker thread for HEIC → PNG decoding.
 *
 * heic-convert is a pure-JS / WASM library. Its decode step is entirely
 * synchronous-on-the-CPU and can take 200–800 ms for a typical 12 MP photo.
 * Running it here keeps that work off the main Node.js event loop so the
 * server can continue accepting and parsing other requests while the
 * conversion is in progress.
 *
 * We decode to a lossless PNG intermediate; the caller (sharp) then resizes
 * and re-encodes to the requested output format (JPEG/PNG/WebP) at the chosen
 * quality, so there is no double-lossy compression.
 *
 * Communication protocol:
 *   Main → Worker  { buffer: Buffer }
 *   Worker → Main  { ok: true,  result: Buffer }   on success
 *   Worker → Main  { ok: false, error: string }    on failure
 */

const { parentPort } = require('worker_threads');
const heicConvert = require('heic-convert');

parentPort.on('message', async ({ buffer }) => {
  try {
    const outputBuffer = await heicConvert({
      buffer,
      format: 'PNG',
    });
    parentPort.postMessage({ ok: true, result: Buffer.from(outputBuffer) });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
});
