'use strict';

// Node's test runner executes each test file in its own process, so tightening
// these env vars here does not affect the ceiling used by the other test files.
process.env.RATE_LIMIT_MAX = '3';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('rate limiter returns 429 once the per-IP ceiling is exceeded', async () => {
  // The limiter runs ahead of the route handlers, so a fileless request still
  // counts against it (and returns fast, since it never reaches multer/sharp).
  for (let i = 0; i < 3; i += 1) {
    const res = await request(app).post('/api/convert/heic');
    assert.equal(res.status, 400);
  }

  const limited = await request(app).post('/api/convert/heic');
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /too many/i);
});
