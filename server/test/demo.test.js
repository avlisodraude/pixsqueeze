'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('local root serves the local playground without redirecting to the hosted demo', async () => {
  const response = await request(app).get('/');
  assert.equal(response.status, 200);
  assert.match(response.text, /<title>PixSqueeze — Local playground<\/title>/);
  assert.match(response.text, /id="compress-form"/);
  assert.doesNotMatch(response.text, /http-equiv="refresh"|location\.replace/);
});

test('static-host index retains its hosted demo redirect', async () => {
  const response = await request(app).get('/index.html');
  assert.equal(response.status, 200);
  assert.match(response.text, /http-equiv="refresh"/);
});
