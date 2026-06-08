'use strict';

/**
 * Worker thread for HEIC → JPEG conversion.
 *
 * heic-convert is a pure-JS / WASM library. Its decode step is entirely
 * synchronous-on-the-CPU and can take 200–800 ms for a typical 12 MP photo.
 * Running it here keeps that work off the main Node.js event loop so the
 * server can continue accepting and parsing other requests while the
 * conversion is in progress.
 *
 * Communication protocol:
 *   Main → Worker  { buffer: Buffer, quality: number }
 *   Worker → Main  { ok: true,  result: Buffer }          on success
 *   Worker → Main  { ok: false, error: string }           on failure
 */

const { parentPort } = require('worker_threads');
const heicConvert = require('heic-convert');

parentPort.on('message', async ({ buffer, quality }) => {
  try {
    const outputBuffer = await heicConvert({
      buffer,
      format: 'JPEG',
      quality,
    });
    parentPort.postMessage({ ok: true, result: Buffer.from(outputBuffer) });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
});
