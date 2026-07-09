'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../app');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name));

test('POST /api/convert/heic returns an actual JPEG (magic bytes), not a mislabeled PNG', async () => {
  const res = await request(app)
    .post('/api/convert/heic')
    .attach('file', fixture('sample.heic'), 'sample.heic');

  assert.equal(res.status, 200);
  assert.deepEqual([...res.body.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal(Number(res.headers['content-length']), res.body.length);
});

test('POST /api/convert/heic rejects a PNG with 415 instead of converting it', async () => {
  const res = await request(app)
    .post('/api/convert/heic')
    .attach('file', fixture('sample.png'), 'sample.png');

  assert.equal(res.status, 415);
});

test('POST /api/convert/tiff returns a JPEG (magic bytes)', async () => {
  const res = await request(app)
    .post('/api/convert/tiff')
    .attach('file', fixture('sample.tiff'), 'sample.tiff');

  assert.equal(res.status, 200);
  assert.deepEqual([...res.body.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('POST /api/convert/heic with no file returns 400', async () => {
  const res = await request(app).post('/api/convert/heic');

  assert.equal(res.status, 400);
});
