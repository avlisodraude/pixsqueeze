describe('PixSqueeze.compress', () => {
  const realFetch = window.fetch;
  let image;

  before(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(256, 256);
    let seed = 42;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    image = await new Promise((resolve) => canvas.toBlob((blob) => resolve(new File([blob], 'noise.png', { type: blob.type }))));
  });

  afterEach(() => { window.fetch = realFetch; });

  async function rejects(work, check) {
    let caught;
    try { await work(); } catch (error) { caught = error; }
    expect(caught, 'expected rejection').to.exist;
    check(caught);
  }

  it('compresses locally and reports the actual output format and dimensions', async () => {
    window.fetch = () => { throw new Error('unexpected upload'); };
    const result = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', maxWidth: 100 });
    expect(result.file).to.be.an.instanceOf(Blob);
    expect(result.originalSize).to.equal(image.size);
    expect(result.outputSize).to.equal(result.file.size);
    expect(result.mimeType).to.equal('image/jpeg');
    expect(result.width).to.equal(100);
    expect(result.height).to.equal(100);
    expect(result.targetMet).to.equal(null);
    expect(result.attempts).to.equal(1);
    expect(result.converted).to.equal(false);
  });

  it('meets a byte target using quality without changing dimensions', async () => {
    const high = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', quality: 0.9 });
    const low = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', quality: 0.2 });
    const targetSize = Math.floor((high.outputSize + low.outputSize) / 2);
    const result = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', quality: 0.9, minQuality: 0.2, targetSize });
    expect(result.targetMet).to.equal(true);
    expect(result.outputSize).to.be.at.most(targetSize);
    expect(result.width).to.equal(256);
    expect(result.height).to.equal(256);
    expect(result.attempts).to.be.within(2, 8);
  });

  it('reports an unattainable target and respects the attempt budget', async () => {
    const result = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', targetSize: 1, maxAttempts: 2 });
    expect(result.targetMet).to.equal(false);
    expect(result.outputSize).to.be.greaterThan(1);
    expect(result.attempts).to.equal(2);
    expect(result.width).to.equal(256);
  });

  it('reports when strict compression returns the original file', async () => {
    const source = await PixSqueeze.compress(image, { mimeType: 'image/jpeg', quality: 0.1 });
    const result = await PixSqueeze.compress(source.file, { quality: 1 });
    expect(result.returnedOriginal).to.equal(true);
    expect(result.file).to.equal(source.file);
    expect(result.outputSize).to.equal(source.outputSize);
    expect(result.width).to.equal(source.width);
  });

  it('reduces dimensions only when allowed, including for PNG output', async () => {
    const fixed = await PixSqueeze.compress(image, { targetSize: 15000 });
    expect(fixed.targetMet).to.equal(false);
    expect(fixed.width).to.equal(256);
    const resized = await PixSqueeze.compress(image, { targetSize: 15000, allowResize: true });
    expect(resized.targetMet).to.equal(true);
    expect(resized.outputSize).to.be.at.most(15000);
    expect(resized.width).to.be.lessThan(256);
    expect(resized.width).to.equal(resized.height);
    expect(resized.mimeType).to.equal('image/png');
  });

  it('respects minimum dimensions even when the target cannot be met', async () => {
    const result = await PixSqueeze.compress(image, {
      targetSize: 1, allowResize: true, minWidth: 200, minHeight: 200,
    });
    expect(result.targetMet).to.equal(false);
    expect(result.width).to.be.at.least(200);
    expect(result.height).to.be.at.least(200);
    expect(result.attempts).to.be.at.most(8);
  });

  it('honors a one-attempt limit', async () => {
    const result = await PixSqueeze.compress(image, { targetSize: 1, allowResize: true, maxAttempts: 1 });
    expect(result.attempts).to.equal(1);
    expect(result.targetMet).to.equal(false);
  });

  it('reports unsupported encoder fallback using the real MIME type', async () => {
    const result = await PixSqueeze.compress(image, { mimeType: 'image/unknown', targetSize: 1 });
    expect(result.mimeType).to.equal('image/png');
    expect(result.targetMet).to.equal(false);
    expect(result.attempts).to.equal(1);
  });

  it('rejects invalid files, byte targets, attempt limits, and quality values', async () => {
    await rejects(() => PixSqueeze.compress('photo'), (error) => expect(error).to.be.an.instanceOf(TypeError));
    for (const targetSize of [0, -1, NaN, Infinity, 0.5]) {
      await rejects(() => PixSqueeze.compress(image, { targetSize }), (error) => expect(error).to.be.an.instanceOf(RangeError));
    }
    for (const options of [{ maxAttempts: 0 }, { maxAttempts: 21 }, { quality: 2 }, { minQuality: -1 }, { timeout: -1 }]) {
      await rejects(() => PixSqueeze.compress(image, options), (error) => expect(error).to.be.an.instanceOf(RangeError));
    }
  });

  it('rejects drawing hook failures immediately', async () => {
    await rejects(() => PixSqueeze.compress(image, { beforeDraw() { throw new Error('drawing failed'); } }),
      (error) => expect(error.message).to.equal('drawing failed'));
  });

  it('rejects an already-cancelled operation without uploading', async () => {
    const controller = new AbortController();
    controller.abort();
    window.fetch = () => { throw new Error('unexpected upload'); };
    await rejects(() => PixSqueeze.compress(image, { signal: controller.signal }),
      (error) => expect(error.name).to.equal('AbortError'));
  });

  it('cancels browser work from a drawing hook', async () => {
    const controller = new AbortController();
    await rejects(() => PixSqueeze.compress(image, {
      signal: controller.signal, beforeDraw() { controller.abort(); },
    }), (error) => expect(error.name).to.equal('AbortError'));
  });

  it('requires an explicit conversion endpoint before uploading', async () => {
    window.fetch = () => { throw new Error('unexpected upload'); };
    await rejects(() => PixSqueeze.compress(new File([], 'phone.heic', { type: 'image/heic' })),
      (error) => expect(error.message).to.include('conversion.heic'));
  });

  it('uploads once, forwards request options, and then meets a target locally', async () => {
    const jpeg = await PixSqueeze.compress(image, { mimeType: 'image/jpeg' });
    let calls = 0;
    window.fetch = async (url, options) => {
      calls += 1;
      expect(url).to.equal('/custom-heic');
      expect(options.headers.Authorization).to.equal('test-token');
      expect(options.credentials).to.equal('include');
      expect(options.body.get('file').name).to.equal('phone.heic');
      return new Response(jpeg.file, { status: 200 });
    };
    const result = await PixSqueeze.compress(new File(['heic'], 'phone.heic', { type: 'image/heic' }), {
      targetSize: 5000, allowResize: true,
      conversion: { heic: '/custom-heic', headers: { Authorization: 'test-token' }, credentials: 'include' },
    });
    expect(calls).to.equal(1);
    expect(result.converted).to.equal(true);
    expect(result.originalSize).to.equal(4);
    expect(result.targetMet).to.equal(true);
  });

  it('routes a named RAW image before its TIFF signature', async () => {
    const jpeg = await PixSqueeze.compress(image, { mimeType: 'image/jpeg' });
    window.fetch = async (url) => {
      expect(url).to.equal('/raw');
      return new Response(jpeg.file);
    };
    const result = await PixSqueeze.compress(new File([new Uint8Array([0x49, 0x49, 0x2a, 0])], 'photo.dng'), {
      conversion: { raw: '/raw', tiff: '/tiff' },
    });
    expect(result.converted).to.equal(true);
  });

  it('propagates server errors', async () => {
    window.fetch = async () => new Response(JSON.stringify({ error: 'decoder unavailable' }), { status: 422 });
    await rejects(() => PixSqueeze.compress(new File([], 'scan.tiff', { type: 'image/tiff' }), {
      conversion: { tiff: '/tiff' },
    }), (error) => expect(error.message).to.include('decoder unavailable'));
  });

  it('times out and aborts a pending conversion request', async () => {
    let requestSignal;
    window.fetch = (_url, options) => new Promise((_resolve, reject) => {
      requestSignal = options.signal;
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
    await rejects(() => PixSqueeze.compress(new File([], 'scan.tiff', { type: 'image/tiff' }), {
      conversion: { tiff: '/tiff' }, timeout: 30,
    }), (error) => expect(error.name).to.equal('TimeoutError'));
    expect(requestSignal.aborted).to.equal(true);
  });
});
