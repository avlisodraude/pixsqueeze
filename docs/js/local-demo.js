/* global PixSqueeze */
(() => {
  const get = (id) => document.getElementById(id);
  const form = get('compress-form');
  const input = get('image-file');
  const status = get('status');
  let controller;
  let generation = 0;
  let urls = [];

  const prettySize = (bytes) => `${(bytes / 1000).toFixed(1)} KB`;
  const cleanPreviews = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [];
    get('result').hidden = true;
  };
  const showStatus = (message, error = false) => {
    status.textContent = message;
    status.dataset.state = error ? 'error' : 'normal';
  };
  const stop = () => {
    generation += 1;
    if (controller) controller.abort();
    controller = null;
    get('cancel').disabled = true;
    get('compress').disabled = false;
  };

  input.addEventListener('change', () => {
    stop();
    cleanPreviews();
    showStatus(input.files[0] ? `${input.files[0].name} is ready to compress.` : 'Choose an image to get started.');
  });
  get('cancel').addEventListener('click', () => {
    stop();
    showStatus('Compression cancelled.');
  });
  get('original-preview').addEventListener('error', () => {
    get('original-preview').hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = input.files[0];
    if (!file) return;
    stop();
    cleanPreviews();
    const run = generation;
    controller = new AbortController();
    get('compress').disabled = true;
    get('cancel').disabled = false;
    const conversion = get('allow-conversion').checked ? {
      heic: '/api/convert/heic', tiff: '/api/convert/tiff', raw: '/api/convert/raw',
    } : undefined;
    showStatus('Processing image…');
    try {
      const output = await PixSqueeze.compress(file, {
        quality: Number(get('quality').value),
        mimeType: get('format').value,
        maxWidth: get('max-width').value ? Number(get('max-width').value) : undefined,
        targetSize: get('target-size').value ? Number(get('target-size').value) * 1000 : undefined,
        allowResize: get('allow-resize').checked,
        conversion,
        signal: controller.signal,
      });
      if (run !== generation) return;
      urls = [URL.createObjectURL(file), URL.createObjectURL(output.file)];
      get('original-preview').hidden = false;
      get('original-preview').src = urls[0];
      get('output-preview').src = urls[1];
      get('original-details').textContent = `${file.name} · ${prettySize(file.size)}`;
      get('output-details').textContent = `${output.mimeType} · ${prettySize(output.outputSize)} · ${output.width} × ${output.height}`;
      const difference = (1 - output.outputSize / Math.max(file.size, 1)) * 100;
      get('summary').textContent = `${Math.abs(difference).toFixed(1)}% ${difference >= 0 ? 'smaller' : 'larger'} · ${output.attempts} encoding attempt(s)${output.converted ? ' · Server conversion used' : ' · Processed in your browser'}`;
      get('download').href = urls[1];
      get('download').download = output.file.name || 'compressed-image';
      get('result').hidden = false;
      if (output.targetMet === false) {
        showStatus('Target size was not reached. The smallest result found is available below.', true);
      } else showStatus(output.targetMet ? 'Target size reached. Your image is ready.' : 'Your image is ready.');
    } catch (error) {
      if (run === generation) {
        const message = error.message || String(error);
        showStatus(message.includes('requires server conversion')
          ? 'This format needs server conversion. Enable the upload checkbox to continue.'
          : message, true);
      }
    } finally {
      if (run === generation) {
        get('compress').disabled = false;
        get('cancel').disabled = true;
        controller = null;
      }
    }
  });
  window.addEventListener('pagehide', () => {
    stop();
    cleanPreviews();
  });
})();
