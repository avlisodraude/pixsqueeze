# PixSqueeze

[![Coverage Status](https://img.shields.io/codecov/c/github/avlisodraude/pixsqueeze.svg)](https://codecov.io/gh/avlisodraude/pixsqueeze) [![Downloads](https://img.shields.io/npm/dm/@alosha/pixsqueeze.svg)](https://www.npmjs.com/package/@alosha/pixsqueeze) [![Version](https://img.shields.io/npm/v/@alosha/pixsqueeze.svg)](https://www.npmjs.com/package/@alosha/pixsqueeze) [![Gzip Size](https://img.shields.io/bundlephobia/minzip/@alosha/pixsqueeze.svg)](https://unpkg.com/@alosha/pixsqueeze/dist/pixsqueeze.common.js) [![Types included](https://img.shields.io/badge/types-included-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> Compress and resize images in the browser, with a Promise API and optional target file sizes. HEIC, TIFF, and camera RAW detection can route files to explicitly configured conversion endpoints. Browser encoding uses [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob); available formats and output sizes depend on the browser, and JPEG/WebP encoding is lossy.

Built by [Alosha](https://alosha.dev) — privacy-first developer tools powered by open source.

- [▶ Live demo](https://pixsqueeze.alosha.dev/demo) · [Hosted Batch API](https://pixsqueeze.alosha.dev)

## Table of contents

- [Quick start](#quick-start)
  - [Asynchronous compression and target sizes](#asynchronous-compression-and-target-sizes)
  - [Result fields](#result-fields)
  - [Cancellation and timeouts](#cancellation-and-timeouts)
  - [Server conversion and request options](#server-conversion-and-request-options)
- [Main Files](#main-files)
- [Getting started](#getting-started)
  - [TypeScript](#typescript)
- [Recipes](#recipes)
  - [Compress an image before upload](#compress-an-image-before-upload)
  - [Resize while compressing](#resize-while-compressing)
  - [Convert to WebP or JPEG](#convert-to-webp-or-jpeg)
  - [Compress an iPhone HEIC photo](#compress-an-iphone-heic-photo)
  - [Compress a TIFF or camera RAW file](#compress-a-tiff-or-camera-raw-file)
  - [Add a watermark while compressing](#add-a-watermark-while-compressing)
  - [Convert to grayscale while compressing](#convert-to-grayscale-while-compressing)
  - [Cancel an in-progress compression](#cancel-an-in-progress-compression)
- [Demo server](#demo-server)
- [Server-side conversion API](#server-side-conversion-api)
- [Batch API](#batch-api)
  - [Production recipes](#production-recipes)
- [Options](#options)
- [Methods](#methods)
- [No conflict](#no-conflict)
- [Browser support](#browser-support)
- [Development and verification](#development-and-verification)
- [Contributing](#contributing)
- [Versioning](#versioning)
- [License](#license)

## Quick start

Install it:

```shell
npm install @alosha/pixsqueeze
```

Compress a file the user picked, in three lines:

```js
import PixSqueeze from "@alosha/pixsqueeze";

new PixSqueeze(file, {
  quality: 0.6,
  success: (result) => uploadToServer(result), // a `File`/`Blob`, ready to send
  error: (err) => console.error(err.message),
});
```

The constructor returns output through `success` and errors through `error`. Quality ranges from `0` to `1`; a larger value generally means higher quality and larger output, but `1` does not restore information lost in the input. For `await` and target-size control, use the static API below. Version 1.5.0 adds the static Promise API, target-size controls, and corrected module/type exports described below. See the [changelog](CHANGELOG.md) for release details.

### Asynchronous compression and target sizes

The callback constructor remains supported. For a Promise, use `PixSqueeze.compress()`:

`targetSize`, `maxAttempts`, `minQuality`, `allowResize`, `conversion`, `signal`, and `timeout` belong to this static API. Passing them to `new PixSqueeze()` does not enable the new workflow. All ordinary compression options are accepted except `success` and `error`; completion and failure belong to the Promise.

```js
import PixSqueeze from '@alosha/pixsqueeze';

const result = await PixSqueeze.compress(file, {
  mimeType: 'image/jpeg',
  targetSize: 500_000, // bytes: 500 KB
  quality: 0.85,
  minQuality: 0.4,
  allowResize: true,
  maxWidth: 1920,
});

if (result.targetMet === false) {
  // Do not send this file to an endpoint with a strict 500 KB limit.
  console.warn('Target size could not be reached:', result.outputSize);
} else {
  const form = new FormData();
  form.append('image', result.file);
  // Send form to your upload endpoint.
}
```

JPEG/WebP quality is searched first, starting at `quality` and going no lower than `minQuality` (or the requested quality when it is lower). Smaller dimensions are allowed only when `allowResize` is `true`; minimum width and height constraints remain in force. PNG encoding does not use a quality search. Every attempt starts from the same input image, rather than recompressing a previous result. Drawing hooks run again on each encoding attempt.

A target is best effort. When it cannot be reached, the Promise resolves with the smallest result found and `targetMet: false`. Network, decoding, and drawing failures reject the Promise. Ordinary compression without a target uses one attempt and returns `targetMet: null`.

| Additional option | Default | Meaning |
| --- | --- | --- |
| `targetSize` | unset | Positive integer output limit in bytes. |
| `maxAttempts` | `8` | Total browser encoding attempts, from 1 to 20. |
| `minQuality` | `0.4` | Lower quality bound, from 0 to 1. |
| `allowResize` | `false` | Permit smaller dimensions to approach the target. |
| `signal` | unset | `AbortSignal` for cancellation, including conversion uploads. |
| `timeout` | `30000` | Total timeout in milliseconds, from 0 to 2147483647; `0` disables it. |
| `conversion` | unset | Explicit server endpoints and optional request headers/credentials. |

Invalid byte targets, attempt limits, quality bounds, and timeout values reject with `RangeError`. `quality` and `minQuality` must be finite numbers from 0 to 1. To keep a large PNG as PNG, set `convertSize: Infinity`; otherwise the existing default can convert PNG inputs over 5,000,000 bytes to JPEG.

### Result fields

| Field | Meaning |
| --- | --- |
| `file` | Output `File`/`Blob`, ready for a download or upload. |
| `originalSize` | Byte size of the caller's original input, before any server conversion. |
| `outputSize` | Byte size of the returned file, including retained EXIF. |
| `mimeType` | Actual output MIME type, including any browser encoder fallback. |
| `width`, `height` | Output dimensions in pixels. |
| `targetSize` | Requested byte target, or `null` without a target. |
| `targetMet` | `true` when output is within the target, `false` when it is not, or `null` without a target. |
| `attempts` | Number of browser encoding attempts; excludes the optional server conversion. |
| `converted` | Whether a configured server conversion was used. |
| `returnedOriginal` | Whether `file` is the same object as the caller's original input. |

Existing `strict` behavior can return the original image when compression would enlarge it. A converted JPEG that is returned unchanged still has `converted: true` and `returnedOriginal: false`, because it is not the original uploaded HEIC/TIFF/RAW file. Returning an original file can also retain its original metadata; `retainExif: false` is not an unconditional metadata-removal guarantee.

### Cancellation and timeouts

```js
const controller = new AbortController();
const pending = PixSqueeze.compress(file, {
  signal: controller.signal,
  timeout: 15_000,
});

// Wire this to your application's cancel button while processing is pending.
cancelButton.addEventListener('click', () => controller.abort(), { once: true });

try {
  const result = await pending;
  console.log(result.file);
} catch (error) {
  if (error.name === 'AbortError') console.log('Cancelled');
  else if (error.name === 'TimeoutError') console.error('Processing timed out');
  else throw error;
}
```

The timeout covers detection, conversion, and browser encoding together. Standard cancellation rejects with `AbortError`; a deadline rejects with `TimeoutError`. If a caller supplies a custom reason to `controller.abort(reason)`, that reason is propagated. A browser encoder already running cannot be interrupted mid-encode, but its late output is discarded. Cancelling an upload does not guarantee that server-side processing has stopped.

### Server conversion and request options

HEIC, TIFF, and RAW conversion is opt-in. No image is uploaded unless the matching endpoint is configured:

```js
const controller = new AbortController();
const result = await PixSqueeze.compress(file, {
  targetSize: 500_000,
  allowResize: true,
  conversion: {
    heic: '/api/convert/heic',
    tiff: '/api/convert/tiff',
    raw: '/api/convert/raw',
    // headers: { Authorization: 'Bearer YOUR_TOKEN' },
    // credentials: 'include',
  },
  signal: controller.signal,
});

// Call controller.abort() from a cancel button while processing is pending.
```

RAW detection uses filename/MIME/header hints; successful conversion depends on the server's installed decoder and the camera format. RAW filenames take precedence over a shared TIFF signature when choosing a configured endpoint. Server conversion happens once, followed by browser encoding attempts. It currently produces an intermediate JPEG at quality 95; browser options such as `targetSize` are not forwarded as server options. This is separate from the hosted Batch API.

Existing direct conversion helpers retain their optional endpoint argument and accept a third request-options argument:

```js
import { convertHeicOnServer } from '@alosha/pixsqueeze/heic';

const controller = new AbortController();
const jpeg = await convertHeicOnServer(file, '/api/convert/heic', {
  signal: controller.signal,
  headers: { Authorization: 'Bearer YOUR_TOKEN' },
  credentials: 'include',
});
```

The same signature applies to `convertTiffOnServer` and `convertRawOnServer`. Let the browser set the multipart `Content-Type` boundary. Direct helpers do not add their own timeout; use an abort signal or the static API's total timeout. Cross-origin headers/credentials also require a matching server CORS policy; the bundled server defaults to a public, credential-free CORS configuration.

[⬆ back to top](#table-of-contents)

## Main Files

```text
dist/
├── pixsqueeze.js        (UMD)
├── pixsqueeze.min.js    (UMD, compressed)
├── pixsqueeze.common.js (CommonJS require entry)
├── pixsqueeze.esm.mjs   (native ESM import entry)
├── pixsqueeze.esm.js    (legacy bundler entry)
├── heic.*              (HEIC detection and conversion helpers)
├── tiff.*              (TIFF detection and conversion helpers)
└── raw.*               (RAW detection and conversion helpers)
types/
├── index.d.ts          (shared class and option declarations)
├── index.d.mts         (ESM declaration entry)
├── index.d.cts         (CommonJS declaration entry)
└── {heic,tiff,raw}.d.ts (helper declarations)
```

Import through `@alosha/pixsqueeze` or the `/heic`, `/tiff`, and `/raw` subpaths. Package exports select the matching JavaScript and declaration entry. The npm package includes `src/`, `dist/`, and `types/`; the demo server and playground are repository-only.

## Getting started

### Install

```shell
npm install @alosha/pixsqueeze
```

### Usage

#### Syntax

```js
new PixSqueeze(file, options); // options is optional
await PixSqueeze.compress(file, asyncOptions); // asyncOptions is optional
```

**file**

- Type: [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) or [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

The target image `File` or `Blob`. Ordinary browser compression requires a decodable image with an image MIME type; set `type` when constructing a Blob yourself. Special-format helpers also inspect filename/header hints before a configured server conversion.

**options**

- Type: `Object`
- Optional

The options for compressing. Check out the available [options](#options).

#### Example

```html
<input type="file" id="file" accept="image/*" />
```

```js
import PixSqueeze from "@alosha/pixsqueeze";

document.getElementById("file").addEventListener("change", (e) => {
  const file = e.target.files[0];

  if (!file) {
    return;
  }

  new PixSqueeze(file, {
    quality: 0.6,

    // The compression process is asynchronous,
    // which means you have to access the `result` in the `success` hook function.
    success(result) {
      const formData = new FormData();

      // Supply a filename explicitly when uploading a Blob.
      formData.append("file", result, result.name);

      // Send the compressed image to your upload endpoint with fetch.
      fetch("/path/to/upload", { method: "POST", body: formData });
    },
    error(err) {
      console.log(err.message);
    },
  });
});
```

### TypeScript

```ts
import PixSqueeze from '@alosha/pixsqueeze';

const options: PixSqueeze.AsyncOptions = {
  mimeType: 'image/jpeg',
  targetSize: 500_000,
  allowResize: true,
};
const result: PixSqueeze.CompressionResult = await PixSqueeze.compress(file, options);
```

CommonJS TypeScript consumers can use `import PixSqueeze = require('@alosha/pixsqueeze')`; CommonJS JavaScript consumers use `const PixSqueeze = require('@alosha/pixsqueeze')`. ESM and bundler consumers use the default import shown above. Available types are `PixSqueeze.Options`, `PixSqueeze.AsyncOptions`, `PixSqueeze.ConversionOptions`, and `PixSqueeze.CompressionResult`. `PixSqueeze.noConflict()` returns the constructor, so it can be saved under another name. Imports do not make the canvas compressor a Node.js or worker image encoder; compression still needs a browser DOM.

[⬆ back to top](#table-of-contents)

## Recipes

Short, focused examples for the situations you'll run into most. Each one is meant to be copied and adapted directly.

### Compress an image before upload

The most common use case — shrink a file the user picked before sending it to your server.

```js
import PixSqueeze from "@alosha/pixsqueeze";

function compressAndUpload(file) {
  new PixSqueeze(file, {
    quality: 0.6,
    success(result) {
      const formData = new FormData();

      formData.append("file", result, result.name);

      fetch("/upload", { method: "POST", body: formData });
    },
    error(err) {
      console.error("Compression failed:", err.message);
    },
  });
}
```

### Resize while compressing

Cap the output dimensions — useful for thumbnails, avatars, or fitting images into a known layout. Use `maxWidth`/`maxHeight` to set a ceiling, or `width`/`height` with `resize` to fit/crop into an exact box.

```js
// Cap the longest side at 1280px, keep the aspect ratio
new PixSqueeze(file, {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.7,
  success: (result) => console.log(result),
});

// Force an exact 400x400 square, cropping to fill (like a profile picture)
new PixSqueeze(file, {
  width: 400,
  height: 400,
  resize: "cover",
  quality: 0.8,
  success: (result) => console.log(result),
});
```

### Convert to WebP or JPEG

Request an output format supported by the current browser — useful for standardizing uploads.

```js
new PixSqueeze(file, {
  mimeType: "image/webp", // or "image/jpeg", "image/png", "auto"
  quality: 0.75,
  success: (result) => console.log(result.type), // inspect the actual encoder result
});
```

> **Note:** Encoder support varies by browser. Canvas can fall back to PNG when the requested format is unavailable. Inspect `result.type`, or `result.mimeType` with the static API. Use a configured server encoder when an exact output format is required.

### Compress an iPhone HEIC photo

For a consistent HEIC/HEIF workflow, detect the format in the browser, POST it to an explicitly configured conversion endpoint, then compress the returned JPEG. Browser decoding support alone does not guarantee canvas encoding support.

> **You need to run the conversion endpoint yourself.** The npm package ships the browser-side compressor and conversion helpers. The Express server that implements `/api/convert/heic`, `/api/convert/tiff` and `/api/convert/raw` lives in [`server/`](server/) in this repository. Deploy it yourself or configure your own compatible endpoints. The hosted Batch API has a separate interface.

```js
import PixSqueeze from "@alosha/pixsqueeze";
import { isHeicFile, convertHeicOnServer } from "@alosha/pixsqueeze/heic";

async function handleFile(file) {
  const resolvedFile = (await isHeicFile(file)) ? await convertHeicOnServer(file) : file;

  new PixSqueeze(resolvedFile, {
    quality: 0.6,
    success: (result) => console.log("Ready to upload:", result),
    error: (err) => console.error(err.message),
  });
}
```

> Run `npm run server` to start the bundled conversion server locally — see [Server-side conversion API](#server-side-conversion-api) for the full endpoint reference and ready-to-use detection helpers.

### Compress a TIFF or camera RAW file

The server-assisted workflow also supports TIFF and detected camera RAW inputs when the installed decoder can process them. Use `conversion.tiff`/`conversion.raw` with `PixSqueeze.compress()`, or the individual subpath helpers shown below.

```js
import PixSqueeze from "@alosha/pixsqueeze";
import { isTiffFile, convertTiffOnServer } from "@alosha/pixsqueeze/tiff";
import { isRawFile, convertRawOnServer } from "@alosha/pixsqueeze/raw";

// Scanned document
if (await isTiffFile(tiffFile)) {
  const jpeg = await convertTiffOnServer(tiffFile);
  new PixSqueeze(jpeg, { quality: 0.7, success: (r) => console.log(r) });
}

// Camera RAW (.cr2, .nef, .arw, .dng, etc. — see the full list in the API docs)
if (await isRawFile(rawFile)) {
  const jpeg = await convertRawOnServer(rawFile);
  new PixSqueeze(jpeg, { quality: 0.7, success: (r) => console.log(r) });
}
```

Each `convert*OnServer` helper takes an optional second argument to override the endpoint and a third argument for `signal`, `headers`, and `credentials`:

```js
const jpeg = await convertRawOnServer(rawFile, "https://images.example.com/convert/raw");
```

See [server conversion and request options](#server-conversion-and-request-options) for the shared request-options contract. An affirmative detector result identifies a candidate format; it does not prove that the server can decode that camera's file.

### Add a watermark while compressing

Use the `drew` hook to draw on top of the image after it's been placed on the canvas, before the final compressed output is produced.

```js
new PixSqueeze(file, {
  quality: 0.8,
  drew(context, canvas) {
    context.font = "bold 2rem sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.6)";
    context.fillText("© Your Brand", 20, canvas.height - 20);
  },
  success: (result) => console.log(result),
});
```

### Convert to grayscale while compressing

Use the `beforeDraw` hook to apply a canvas filter before the image is drawn.

```js
new PixSqueeze(file, {
  quality: 0.8,
  beforeDraw(context, canvas) {
    context.filter = "grayscale(100%)";
  },
  success: (result) => console.log(result),
});
```

### Cancel an in-progress compression

Useful when the user picks a new file before the previous compression finishes, or navigates away.

For `PixSqueeze.compress()`, pass an `AbortSignal` as shown under [cancellation and timeouts](#cancellation-and-timeouts). The instance method below belongs to the callback API.

```js
const job = new PixSqueeze(file, {
  success: (result) => console.log(result),
  error: (err) => console.log("Aborted or failed:", err.message),
});

// Later, e.g. on a "cancel" button click or when a newer file is selected:
job.abort();
```

[⬆ back to top](#table-of-contents)

## Demo server

An Express development server lives under `server/` **in this repository**. It serves the `docs/` demo page and exposes the server-side conversion API endpoints.

> This server is **not** part of the npm package — `npm install @alosha/pixsqueeze` gives you the browser-side compressor and the conversion helpers, not the endpoints they call. To use HEIC/TIFF/RAW conversion in production you must deploy this server yourself (or reimplement the three endpoints against your own image pipeline). It is a development server: review it before exposing it to untrusted input.

### Start the server

```shell
npm ci
npm run build
npm run server
```

Open `http://localhost:3000` after running `npm run build` and `npm run server`. Set the `PORT` environment variable to override. The root serves a self-contained local playground with quality, dimensions, target size, cancellation, previews, and downloads. It uses the local conversion endpoints only when the upload checkbox is enabled. No CDN or hosted demo is required. The separate `docs/index.html` remains a redirect for static hosting.

Environment variables:

| Variable                 | Default | Purpose                                                     |
| ------------------------ | ------- | ------------------------------------------------------------ |
| `PORT`                   | `3000`  | Local server port; for example, `PORT=4173 npm run server`. |
| `CORS_ORIGIN`             | `*`     | Allowed origin(s) for the conversion API. Comma-separate for multiple. Pin this in production. |
| `MAX_UPLOAD_MB`           | `100`   | Per-upload size ceiling.                                     |
| `UPLOAD_CONCURRENCY`      | `6`     | Max requests holding an upload buffer in memory at once.     |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate-limit window, per IP, for the conversion endpoints.     |
| `RATE_LIMIT_MAX`          | `20`    | Max conversion requests per IP per window.                   |
| `HEIC_WORKER_TIMEOUT_MS`  | `30000` | Max time a HEIC decode may run before its worker is killed.  |

### Server dependencies

| Package             | Purpose                                                    |
| -------------------- | ----------------------------------------------------------- |
| `express`            | HTTP server                                                 |
| `cors`               | Cross-origin access to the conversion API                   |
| `express-rate-limit` | Per-IP request limiting on the conversion endpoints         |
| `multer`             | Multipart file upload handling (see `MAX_UPLOAD_MB`)        |
| `sharp`              | JPEG encoding and supported TIFF/RAW decoding via libvips   |
| `heic-convert`       | HEIC/HEIF → PNG decoding in a fixed worker pool; Sharp then encodes JPEG |
| `compression`        | Gzip/Brotli for static assets and JSON responses             |

[⬆ back to top](#table-of-contents)

## Server-side conversion API

These repository-only endpoints provide server-assisted conversion. The local playground uses them only when its upload checkbox is enabled; `PixSqueeze.compress()` uses only endpoints explicitly configured by the caller. The callback constructor never uploads an image by itself.

All endpoints accept a `multipart/form-data` POST with a single field named `file` and respond with:

- **`200`** — `image/jpeg` binary body + `X-Original-Name` header with the renamed filename
- **`400`** — No file uploaded or malformed request
- **`413`** — File exceeds the `MAX_UPLOAD_MB` upload limit
- **`415`** — File type not accepted by this endpoint
- **`422`** — Conversion failed (corrupt or unsupported variant)
- **`429`** — Too many conversion requests from this IP; retry after the rate-limit window

### `POST /api/convert/heic`

Converts a HEIC/HEIF image to JPEG at quality 95. A matching MIME type **or** ISO Base Media File Format header is accepted, including files with an empty MIME type. HEIC decoding runs in a worker pool, followed by Sharp JPEG encoding. Both `.heic` and `.heif` filenames receive a `.jpg` output extension.

```shell
curl -X POST http://localhost:3000/api/convert/heic \
  -F "file=@photo.heic" \
  --output photo.jpg
```

### `POST /api/convert/tiff`

Converts a TIFF image to JPEG at quality 95. A matching MIME type, `.tiff`/`.tif` extension, or little/big-endian header is accepted. For multi-page TIFF input, the current endpoint converts the first page; it does not return a page collection.

```shell
curl -X POST http://localhost:3000/api/convert/tiff \
  -F "file=@scan.tiff" \
  --output scan.jpg
```

### `POST /api/convert/raw`

Attempts camera RAW conversion to JPEG at quality 95 and applies embedded orientation metadata. The following extensions are recognized for routing; actual conversion depends on the installed decoder and camera variant:

| Format    | Extensions                                     |
| --------- | ---------------------------------------------- |
| Adobe DNG | `.dng`                                         |
| Canon     | `.cr2`, `.cr3`                                 |
| Nikon     | `.nef`, `.nrw`                                 |
| Sony      | `.arw`                                         |
| Fujifilm  | `.raf`                                         |
| Panasonic | `.rw2`                                         |
| Pentax    | `.pef`                                         |
| Olympus   | `.orf`                                         |
| Samsung   | `.srw`                                         |
| Other     | `.3fr`, `.dcr`, `.kdc`, `.mrw`, `.rwl`, `.x3f` |

> **Note:** Recognizing a RAW extension or TIFF container is not a guarantee of camera RAW decoding. Some variants require a libvips build with LibRaw support. Unsupported or corrupt inputs return `422`. Validate representative camera fixtures against your deployment before promising support.

```shell
curl -X POST http://localhost:3000/api/convert/raw \
  -F "file=@DSC_0001.NEF" \
  --output DSC_0001.jpg
```

[⬆ back to top](#table-of-contents)

## Batch API

This is a separate hosted service. The static `PixSqueeze.compress()` API, its target-size settings, and the local `/api/convert/*` endpoints are implemented in this repository; they do not establish support for equivalent options in the hosted service.

Need to compress hundreds or thousands of images server-side — without a browser? The **PixSqueeze Batch API** is a hosted REST API that accepts up to 1,000 images per request and returns compressed results as base64-encoded files.

### Pricing

| Plan       | Images / month | Price      |
| ---------- | -------------- | ---------- |
| Free       | 100            | $0         |
| Starter    | 2,000          | $9 / mo    |
| Pro        | 20,000         | $29 / mo   |
| Business   | Unlimited      | $99 / mo   |

Full documentation and dashboard: [alosha.dev](https://alosha.dev) · [API docs](https://alosha.dev/docs)

### Get an API key

```shell
curl -X POST https://pixsqueeze-api-production.up.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Response:

```json
{
  "apiKey": "psx_...",
  "plan": "FREE",
  "monthlyLimit": 100,
  "message": "Account created. Keep your API key safe — it will not be shown again."
}
```

> **Note:** your key is shown only once. Registering an already-used email returns `409` — it never reveals the existing key. If you lose or leak your key, rotate it: `POST /auth/rotate-key` with `Authorization: Bearer <current-key>` returns a fresh key and revokes the old one.

### Compress a batch of images

```shell
curl -X POST https://pixsqueeze-api-production.up.railway.app/compress/batch \
  -H "Authorization: Bearer psx_YOUR_API_KEY" \
  -F "files[]=@photo1.jpg" \
  -F "files[]=@photo2.heic" \
  -F "files[]=@scan.tiff" \
  -F "quality=0.7" \
  -F "maxWidth=1280"
```

Response:

```json
{
  "processed": 3,
  "results": [
    { "originalName": "photo1.jpg", "mimeType": "image/jpeg", "data": "base64..." },
    { "originalName": "photo2.heic", "mimeType": "image/jpeg", "data": "base64..." },
    { "originalName": "scan.tiff",  "mimeType": "image/jpeg", "data": "base64..." }
  ],
  "usage": { "used": 3, "limit": 100, "remaining": 97 }
}
```

Supported input formats: JPEG, PNG, WebP, GIF, HEIC/HEIF, TIFF, and camera RAW (CR2, NEF, ARW, DNG, and more).

### Production recipes

Real problems, complete solutions — copy, paste, ship.

#### Compress and store user uploads in your Node backend

**The problem:** you want to shrink every uploaded image before it hits storage, without bundling an image library or a native codec into your API.

```js
import { writeFile } from "node:fs/promises";

// Forward an upload to PixSqueeze, then persist the compressed result.
const form = new FormData();
form.append("files[]", new Blob([buffer]), "upload.jpg");
form.append("quality", "0.7");
form.append("maxWidth", "1600");

const res = await fetch("https://pixsqueeze-api-production.up.railway.app/compress/batch", {
  method: "POST",
  headers: { Authorization: "Bearer " + process.env.PIXSQUEEZE_KEY },
  body: form,
});

const { results, usage } = await res.json();
for (const img of results) {
  await writeFile(img.originalName, Buffer.from(img.data, "base64"));
}
console.log(usage.remaining + " compressions left this month");
```

**Why it works:** the batch endpoint returns each compressed image as base64 plus a live usage counter in one round-trip, so you compress, persist, and track quota without a second call or any image library in your own stack.

#### Convert iPhone HEIC uploads to WebP on the fly

**The problem:** phones upload HEIC and cameras upload RAW — formats browsers cannot display — and decoding them client-side is a non-starter.

```js
// Browsers can't decode HEIC — let PixSqueeze convert + compress server-side.
const form = new FormData();
form.append("files[]", heicFile); // a .heic straight from an iPhone
form.append("mimeType", "image/webp"); // force WebP output
form.append("quality", "0.8");

const res = await fetch("https://pixsqueeze-api-production.up.railway.app/compress/batch", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey },
  body: form,
});

const { results } = await res.json();
const src = "data:image/webp;base64," + results[0].data; // ready for <img src>
```

**Why it works:** PixSqueeze decodes HEIC/RAW/TIFF server-side and re-encodes to a web format in the same request, so you accept whatever a device produces and hand the browser a WebP it can actually render — no client-side codec.

### Check monthly usage

```shell
curl https://pixsqueeze-api-production.up.railway.app/usage \
  -H "Authorization: Bearer psx_YOUR_API_KEY"
```

```json
{
  "plan": "FREE",
  "used": 3,
  "limit": 100,
  "remaining": 97,
  "resetDate": "2026-07-01"
}
```

[⬆ back to top](#table-of-contents)

## Options

The ordinary compression options below apply to the constructor and to `PixSqueeze.compress()`, except the `success`/`error` callbacks. See [asynchronous compression and target sizes](#asynchronous-compression-and-target-sizes) for the static API's additional options. Use `PixSqueeze.setDefaults(options)` to change shared ordinary defaults; the target-search, conversion, cancellation, and timeout controls are per-call static options.

### strict

- Type: `boolean`
- Default: `true`

Indicates whether to output the original image instead of the compressed one when the size of the compressed image is greater than the original one's, except the following cases:

- The `retainExif` option is set to `true`.
- The `mimeType` option is set and its value is different from the mime type of the image.
- The `width` option is set and its value is greater than the natural width of the image.
- The `height` option is set and its value is greater than the natural height of the image.
- The `minWidth` option is set and its value is greater than the natural width of the image.
- The `minHeight` option is set and its value is greater than the natural height of the image.
- The `maxWidth` option is set and its value is less than the natural width of the image.
- The `maxHeight` option is set and its value is less than the natural height of the image.

### checkOrientation

- Type: `boolean`
- Default: `true`

Indicates whether to read the image's Exif Orientation value (JPEG image only), and then rotate or flip the image automatically with the value.

**Notes:**

- Don't trust this all the time as some JPEG images have incorrect (not standard) Orientation values.
- If the size of the target image is too large (e.g., greater than 10 MB), you should disable this option to avoid an out-of-memory crash.
- Re-encoding removes EXIF unless `retainExif` is enabled for JPEG output. A fallback to the original file can preserve its original metadata.

### retainExif

- Type: `boolean`
- Default: `false`

For JPEG input/output, indicates whether to reinsert the source EXIF after encoding. `false` skips reinsertion; it does not strip metadata from an original file returned by `strict` or canvas fallback. When targeting a size, retained EXIF counts toward the returned output size.

### maxWidth

- Type: `number`
- Default: `Infinity`

The max-width of the output image. The value should be greater than `0`.

> Avoid getting a blank output image, you might need to set the `maxWidth` and `maxHeight` options to limited numbers, because of [the size limits of a canvas element](https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element), recommend to use `4096` or lesser.

### maxHeight

- Type: `number`
- Default: `Infinity`

The max height of the output image. The value should be greater than `0`.

### minWidth

- Type: `number`
- Default: `0`

The min-width of the output image. The value should be greater than `0` and should not be greater than the `maxWidth`.

### minHeight

- Type: `number`
- Default: `0`

The min-height of the output image. The value should be greater than `0` and should not be greater than the `maxHeight`.

### width

- Type: `number`
- Default: `undefined`

The width of the output image. If not specified, the natural width of the original image will be used, or if the `height` option is set, the width will be computed automatically by the natural aspect ratio.

### height

- Type: `number`
- Default: `undefined`

The height of the output image. If not specified, the natural height of the original image will be used, or if the `width` option is set, the height will be computed automatically by the natural aspect ratio.

### resize

- Type: `string`
- Default: `"none"`
- Options: `"none"`, `"contain"`, and `"cover"`.

Sets how the size of the image should be resized to the container specified by the `width` and `height` options.

**Note:** This option only available when both the `width` and `height` options are specified.

### quality

- Type: `number`
- Default: `0.8`

The quality of the output image, from `0` to `1`. The callback API passes its value to the browser encoder, which can use its own default for invalid input. The static API validates the range and rejects invalid values. With a target size, this is the initial quality and upper search bound. `1` can enlarge an image and is not a promise of lossless output.

**Note:** This option only available for `image/jpeg` and `image/webp` images.

> Check out the documentation of the [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) method for more detail.

**Examples**:

The following quality/size measurements are illustrative results for an earlier sample. They are not cross-browser guarantees or a calibration for `targetSize`.

| Quality | Input size | Output size | Compression ratio | Description   |
| ------- | ---------- | ----------- | ----------------- | ------------- |
| 0       | 2.12 MB    | 114.61 KB   | 94.72%            | -             |
| 0.2     | 2.12 MB    | 349.57 KB   | 83.90%            | -             |
| 0.4     | 2.12 MB    | 517.10 KB   | 76.18%            | -             |
| 0.6     | 2.12 MB    | 694.99 KB   | 67.99%            | Recommend     |
| 0.8     | 2.12 MB    | 1.14 MB     | 46.41%            | Recommend     |
| 1       | 2.12 MB    | 2.12 MB     | 0%                | Not recommend |
| NaN     | 2.12 MB    | 2.01 MB     | 5.02%             | -             |

### mimeType

- Type: `string`
- Default: `'auto'`
- Options: `"auto"`, `"image/png"`, `"image/jpeg"`, and `"image/webp"`.

The mime type of the output image. By default, the original mime type of the source image file will be used.

> Encoder availability varies by browser. An unavailable encoder can fall back to PNG. Inspect the returned MIME type rather than assuming the requested format was produced.

### convertTypes

- Type: `Array` or `string` (multiple types should be separated by commas)
- Default: `["image/png"]`
- Examples:
  - `["image/png", "image/webp"]`
  - `"image/png,image/webp"`

Files whose file type is included in this list, and whose file size exceeds the `convertSize` value will be converted to JPEGs.

> For image file type support, see the [Image file type and format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types).

### convertSize

- Type: `number`
- Default: `5000000` (5 MB)

Files whose file type is included in the `convertTypes` list, and whose file size exceeds this value will be converted to JPEGs. To disable this, just set the value to `Infinity`.

**Examples**:

| convertSize | Input size (type) | Output size (type) | Compression ratio |
| ----------- | ----------------- | ------------------ | ----------------- |
| 5 MB        | 1.87 MB (PNG)     | 1.87 MB (PNG)      | 0%                |
| 5 MB        | 5.66 MB (PNG)     | 450.24 KB (JPEG)   | 92.23%            |
| 5 MB        | 9.74 MB (PNG)     | 883.89 KB (JPEG)   | 91.14%            |

### beforeDraw(context, canvas)

- Type: `Function`
- Default: `null`
- Parameters:
  - `context`: The 2d rendering context of the canvas.
  - `canvas`: The canvas for compression.

The hook function to execute before drawing the image into the canvas for compression.

With target-size compression, the hook can run once per encoding attempt. Draw from the provided canvas/input rather than accumulating changes on a previous compressed result.

```js
new PixSqueeze(file, {
  beforeDraw(context, canvas) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = "grayscale(100%)";
  },
});
```

### drew(context, canvas)

- Type: `Function`
- Default: `null`
- Parameters:
  - `context`: The 2d rendering context of the canvas.
  - `canvas`: The canvas for compression.

The hook function to execute after drawing the image into the canvas for compression.

With target-size compression, the hook can run once per encoding attempt. A thrown drawing error rejects the static API's Promise.

```js
new PixSqueeze(file, {
  drew(context, canvas) {
    context.fillStyle = "#fff";
    context.font = "2rem serif";
    context.fillText("watermark", 20, canvas.height - 20);
  },
});
```

### success(result)

- Type: `Function`
- Default: `null`
- Parameters:
  - `result`: The compressed image (a `File` (**read only**) or `Blob` object).

Callback constructor only. `PixSqueeze.compress()` resolves with a result object whose `file` field contains this output.

### error(err)

- Type: `Function`
- Default: `null`
- Parameters:
  - `err`: The compression error (an `Error` object).

Callback constructor only. `PixSqueeze.compress()` rejects on validation, decoding, conversion, drawing, cancellation, or timeout failures. An unmet byte target resolves with `targetMet: false` instead of rejecting.

[⬆ back to top](#table-of-contents)

## Methods

### PixSqueeze.compress(file, options)

Static Promise API for local compression, target-size search, and explicitly configured server conversion. See [asynchronous compression and target sizes](#asynchronous-compression-and-target-sizes) for options and [result fields](#result-fields) for its return value. It does not return an instance with `.abort()`; pass an `AbortSignal` instead.

### abort()

Abort a callback constructor instance. It suppresses late encoding success and invokes the error callback; it cannot interrupt a browser encoder that is already running.

```js
const compressor = new PixSqueeze(file);

// Do something...
compressor.abort();
```

## No conflict

If you have to use another compressor with the same namespace, just call the `PixSqueeze.noConflict` static method to revert to it.

```html
<script src="other-compressor.js"></script>
<script src="pixsqueeze.js"></script>
<script>
  const MyPixSqueeze = PixSqueeze.noConflict();
  // Code that uses other `PixSqueeze` can follow here.
  // Use MyPixSqueeze for this library, including MyPixSqueeze.compress().
</script>
```

## Browser support

Use a modern browser with canvas encoding, `File`/`Blob`, object URLs, and `FileReader`. The static API additionally uses Promises, `Blob.arrayBuffer()`, `AbortController`, and `DOMException`; configured conversion requires `fetch` and `FormData`. The [local playground](docs/local.html) runs from the Node demo server, not directly from a `file://` URL.

Supported encoders, canvas size limits, and output quality vary by browser. The automated browser suite uses Puppeteer-managed headless Chrome; it does not establish Firefox, Safari, Edge, mobile-device, or hosted-service acceptance. Test those environments for your application.

## Development and verification

Use Node.js 24, matching CI, and install the lockfile with `npm ci`. Install the test browser once with `npx puppeteer browsers install chrome`. The published package has no runtime npm dependencies; the repository's conversion server still uses packages listed under `devDependencies`.

| Command | Purpose |
| --- | --- |
| `npm run build` | Generate UMD, CommonJS, ESM `.mjs`/legacy `.js`, and helper bundles. |
| `npm run dev` / `npm start` | Watch source changes and rebuild bundles; does not start the HTTP server. |
| `npm run server` | Serve the local playground and conversion routes. |
| `npm run lint` | Lint JavaScript and CSS, applying configured automatic fixes. |
| `npm test` | Build and run the browser regression suite in headless Chrome. |
| `npm run test:types` | Check ESM/CommonJS/bundler declarations and runtime package imports against existing builds. |
| `npm run test:server` | Check conversion, HEIF filenames, upload errors, CORS, rate limiting, and local/static demo routing. |
| `npm run test:demo` | Build and check browser targets, HEIC/TIFF uploads, downloads, responsive layout, cancellation, and unmet targets. |
| `npm run release` | Clean, lint, build through the test scripts, and run all four test suites; does not publish or deploy. |

See the [contributor guide](.github/CONTRIBUTING.md#development-setup-and-verification) for source layout, test ownership, dependency-audit guidance, and packaging checks. The [documentation index](docs/README.md) links the runnable browser and hosted-service examples.

## Contributing

Please read through our [contributing guidelines](.github/CONTRIBUTING.md).

## Versioning

Maintained under the [Semantic Versioning guidelines](https://semver.org/).

## License

[MIT](https://opensource.org/licenses/MIT) © Eduardo Silva Navarrete

---

Built by [Alosha](https://alosha.dev). PixSqueeze is part of the Alosha open-source portfolio — see the hosted offering at [pixsqueeze.alosha.dev](https://pixsqueeze.alosha.dev).

[⬆ back to top](#table-of-contents)
