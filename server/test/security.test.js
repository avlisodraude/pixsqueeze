'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const request = require('supertest');
const app = require('../app');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name));

// ─── CORS ────────────────────────────────────────────────────────────────────

test('CORS: allows the default "*" origin and exposes X-Original-Name', async () => {
  const res = await request(app)
    .post('/api/convert/heic')
    .set('Origin', 'https://example.com')
    .attach('file', fixture('sample.heic'), 'sample.heic');

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  assert.match(res.headers['access-control-expose-headers'] || '', /X-Original-Name/i);
});

test('CORS: preflight OPTIONS request is handled', async () => {
  const res = await request(app)
    .options('/api/convert/heic')
    .set('Origin', 'https://example.com')
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], '*');
});

// ─── X-Original-Name sanitisation ───────────────────────────────────────────

// Node's res.setHeader/res.set throw ERR_INVALID_CHAR on CR/LF in a header
// value (verified via http.validateHeaderValue, the same check they use
// internally) — so an unsanitised filename is a crash vector, not classic
// header injection. This exercises that check directly, independent of
// whether a given multipart client happens to let raw CR/LF through.
test('sanitizeHeaderFilename: CR/LF is removed so the value never fails Node header validation', () => {
  const malicious = 'evil\r\nX-Injected: pwned.jpg';
  const safe = app.sanitizeHeaderFilename(malicious);

  assert.doesNotMatch(safe, /[\r\n]/);
  assert.doesNotThrow(() => http.validateHeaderValue('X-Original-Name', safe));
});

// HTTP header values are transmitted as Latin-1. A UTF-8 filename like
// "café.jpg" round-trips as mangled mojibake ("cafÃ©.jpg") rather than
// throwing — verified empirically. Reducing to a safe ASCII subset avoids
// that corruption.
test('sanitizeHeaderFilename: non-ASCII characters are reduced to a safe subset', () => {
  const safe = app.sanitizeHeaderFilename('café.heic');
  assert.match(safe, /^[\x20-\x7E]*$/);
  assert.doesNotThrow(() => http.validateHeaderValue('X-Original-Name', safe));
});

test('POST /api/convert/heic with a CRLF-bearing filename succeeds instead of crashing', async () => {
  const res = await request(app)
    .post('/api/convert/heic')
    .attach('file', fixture('sample.heic'), 'evil\r\nX-Injected: pwned.jpg');

  assert.equal(res.status, 200);
  assert.doesNotMatch(res.headers['x-original-name'], /[\r\n]/);
});

test('POST /api/convert/heic with a café.heic filename succeeds with an ASCII-safe header', async () => {
  const res = await request(app)
    .post('/api/convert/heic')
    .attach('file', fixture('sample.heic'), 'café.heic');

  assert.equal(res.status, 200);
  assert.match(res.headers['x-original-name'], /^[\x20-\x7E]*$/);
});
