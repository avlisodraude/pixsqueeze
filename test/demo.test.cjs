/* global document, window */
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const puppeteer = require('puppeteer');
const app = require('../server/app');

test('local playground handles browser targets, explicit conversion, downloads, and failures', { timeout: 60000 }, async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  const conversionRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST') conversionRequests.push(request.url());
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await page.goto(baseUrl);
  assert.equal(page.url(), `${baseUrl}/`);
  assert.equal(await page.title(), 'PixSqueeze — Local playground');
  const fileInput = await page.$('#image-file');
  await fileInput.uploadFile(path.join(__dirname, '../docs/images/picture.jpg'));
  await page.$eval('#target-size', (element) => { element.value = '15'; });
  await page.click('#allow-resize');
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Target size reached'));
  assert.equal(conversionRequests.length, 0, 'JPEG processing must stay in the browser');
  const outputBytes = await page.$eval('#download', async (link) => (await (await fetch(link.href)).blob()).size);
  assert.ok(outputBytes <= 15000, `Expected at most 15000 bytes, got ${outputBytes}`);
  assert.match(await page.$eval('#download', (link) => link.download), /\.jpg$/);

  // Verify that the same result is usable on a narrow viewport.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  if (process.env.DEMO_SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(process.env.DEMO_SCREENSHOT_DIR, 'pixsqueeze-mobile.png'), fullPage: true });
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await page.screenshot({ path: path.join(process.env.DEMO_SCREENSHOT_DIR, 'pixsqueeze-desktop.png'), fullPage: true });
  }

  await fileInput.uploadFile(path.join(__dirname, '../server/test/fixtures/sample.heic'));
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Enable the upload checkbox'));
  assert.equal(conversionRequests.length, 0, 'Conversion requires explicit opt-in');
  await page.click('#allow-conversion');
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ready.'));
  assert.equal(conversionRequests.length, 1);
  assert.equal(conversionRequests[0], `${baseUrl}/api/convert/heic`);
  assert.match(await page.$eval('#summary', (element) => element.textContent), /Server conversion used/);
  assert.ok(await page.$eval('#output-preview', (element) => element.complete && element.naturalWidth > 0));

  await fileInput.uploadFile(path.join(__dirname, '../server/test/fixtures/sample.tiff'));
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ready.'));
  assert.equal(conversionRequests.length, 2);
  assert.equal(conversionRequests[1], `${baseUrl}/api/convert/tiff`);

  await fileInput.uploadFile(path.join(__dirname, '../docs/images/picture.png'));
  await page.$eval('#target-size', (element) => { element.value = '1'; });
  await page.click('#allow-resize');
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Target size was not reached'));
  assert.equal(await page.$eval('#result', (element) => element.hidden), false);

  // A delayed conversion lets a person cancel before the server responds.
  await fileInput.uploadFile(path.join(__dirname, '../server/test/fixtures/sample.heic'));
  await page.setRequestInterception(true);
  let pendingRequest;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/convert/heic')) pendingRequest = request;
    else request.continue();
  });
  await page.click('#compress');
  await page.waitForFunction(() => document.querySelector('#cancel').disabled === false);
  await page.click('#cancel');
  assert.equal(await page.$eval('#status', (element) => element.textContent), 'Compression cancelled.');
  assert.equal(await page.$eval('#compress', (element) => element.disabled), false);
  assert.equal(await page.$eval('#result', (element) => element.hidden), true);
  if (pendingRequest) await pendingRequest.abort().catch(() => {});


  assert.deepEqual(errors, []);
});
