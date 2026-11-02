import DEFAULTS from './defaults';
import { isBlob } from './utilities';
import { isHeicFile, convertHeicOnServer } from './heic';
import { isRawFile, convertRawOnServer } from './raw';
import { isTiffFile, convertTiffOnServer } from './tiff';

function abortReason(signal) {
  if (signal.reason !== undefined) return signal.reason;
  return new DOMException('The compression process has been aborted.', 'AbortError');
}

// Race even file detection against cancellation; always consume late rejections.
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(work).then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function encode(Compressor, file, options, signal) {
  return new Promise((resolve, reject) => {
    let job;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => {
      finish(reject, abortReason(signal));
      if (job) job.abort();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      job = new Compressor(file, {
        ...options,
        success(result) {
          finish(resolve, { file: result, width: this.outputWidth, height: this.outputHeight });
        },
        error(error) {
          finish(reject, error);
        },
      });
      // A synchronous drawing hook can abort before the constructor returns.
      if (signal.aborted) job.abort();
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function prepare(file, conversion, signal) {
  // RAW extensions take precedence over their shared TIFF container signature.
  const formats = [
    ['raw', isRawFile, convertRawOnServer],
    ['heic', isHeicFile, convertHeicOnServer],
    ['tiff', isTiffFile, convertTiffOnServer],
  ];
  for (const [format, detect, convert] of formats) {
    if (await abortable(() => detect(file), signal)) {
      const endpoint = conversion && conversion[format];
      if (typeof endpoint !== 'string' || !endpoint.trim()) {
        throw new Error(`${format.toUpperCase()} requires server conversion. Configure conversion.${format} to allow uploading this file.`);
      }
      const result = await abortable(() => convert(file, endpoint, { ...conversion, signal }), signal);
      return { file: result, converted: true };
    }
  }
  return { file, converted: false };
}

/** Orchestrates the opt-in Promise API without changing the callback constructor. */
export default async function compress(Compressor, file, options = {}) {
  if (!isBlob(file)) throw new TypeError('The first argument must be a File or Blob object.');
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object.');
  const {
    targetSize = null,
    maxAttempts = 8,
    minQuality = 0.4,
    allowResize = false,
    conversion,
    signal: externalSignal,
    timeout = 30000,
    ...requested
  } = options;
  if (targetSize !== null && (!Number.isSafeInteger(targetSize) || targetSize < 1)) {
    throw new RangeError('targetSize must be a positive integer number of bytes.');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new RangeError('maxAttempts must be an integer from 1 to 20.');
  }
  const quality = requested.quality === undefined ? DEFAULTS.quality : requested.quality;
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new RangeError('quality must be between 0 and 1.');
  }
  if (!Number.isFinite(minQuality) || minQuality < 0 || minQuality > 1) {
    throw new RangeError('minQuality must be between 0 and 1.');
  }
  if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2147483647) {
    throw new RangeError('timeout must be between 0 and 2147483647 milliseconds.');
  }

  const controller = new AbortController();
  const { signal } = controller;
  const forwardAbort = () => controller.abort(abortReason(externalSignal));
  if (externalSignal) {
    if (externalSignal.aborted) forwardAbort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = timeout > 0 ? setTimeout(() => {
    controller.abort(new DOMException('Image compression timed out.', 'TimeoutError'));
  }, timeout) : null;

  try {
    if (signal.aborted) throw abortReason(signal);
    const source = await prepare(file, conversion, signal);
    const baseOptions = { ...requested, quality };
    // Async results belong to the Promise; callback options are ignored.
    delete baseOptions.success;
    delete baseOptions.error;
    let attempts = 0;
    const attempt = async (settings) => {
      attempts += 1;
      return encode(Compressor, source.file, settings, signal);
    };
    let best = await attempt(baseOptions);
    const fits = (result) => result.file.size <= targetSize;
    const select = (candidate) => {
      if (candidate.file.size < best.file.size) best = candidate;
    };

    if (targetSize !== null && !fits(best)) {
      // Search from the original decoded input on every attempt, never from a
      // previously encoded JPEG. PNG and fallback encoders skip quality search.
      const lossy = ['image/jpeg', 'image/webp'].includes(best.file.type);
      let low = Math.min(minQuality, quality);
      let high = quality;
      if (lossy && low < high && attempts < maxAttempts) {
        const smallest = await attempt({ ...baseOptions, quality: low });
        select(smallest);
        if (fits(smallest)) {
          best = smallest;
          while (attempts < maxAttempts && high - low > 0.01) {
            const nextQuality = (low + high) / 2;
            const next = await attempt({ ...baseOptions, quality: nextQuality });
            if (fits(next)) {
              best = next;
              low = nextQuality;
            } else high = nextQuality;
          }
        }
      }

      let previous = best;
      while (!fits(best) && allowResize && attempts < maxAttempts) {
        const factor = Math.max(0.1, Math.min(0.85, Math.sqrt(targetSize / previous.file.size) * 0.9));
        const minWidth = Math.max(1, Math.ceil(Number(baseOptions.minWidth) || 1));
        const minHeight = Math.max(1, Math.ceil(Number(baseOptions.minHeight) || 1));
        // Keep the aspect ratio while respecting both minimum dimensions.
        const scale = Math.max(factor, minWidth / previous.width, minHeight / previous.height);
        if (scale >= 1) break;
        const width = Math.max(minWidth, Math.floor(previous.width * scale));
        const height = Math.max(minHeight, Math.floor(previous.height * scale));
        if (width >= previous.width && height >= previous.height) break;
        previous = await attempt({ ...baseOptions, width, height, quality: low, strict: false });
        select(previous);
      }
    }

    if (signal.aborted) throw abortReason(signal);
    return {
      ...best,
      originalSize: file.size,
      outputSize: best.file.size,
      mimeType: best.file.type,
      targetSize,
      targetMet: targetSize === null ? null : fits(best),
      attempts,
      converted: source.converted,
      returnedOriginal: best.file === file,
    };
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
  }
}
