# PixSqueeze

[![Coverage Status](https://img.shields.io/codecov/c/github/avlisodraude/pixsqueeze.svg)](https://codecov.io/gh/avlisodraude/pixsqueeze) [![Downloads](https://img.shields.io/npm/dm/@alosha/pixsqueeze.svg)](https://www.npmjs.com/package/@alosha/pixsqueeze) [![Version](https://img.shields.io/npm/v/@alosha/pixsqueeze.svg)](https://www.npmjs.com/package/@alosha/pixsqueeze) [![Gzip Size](https://img.shields.io/bundlephobia/minzip/@alosha/pixsqueeze.svg)](https://unpkg.com/@alosha/pixsqueeze/dist/pixsqueeze.common.js) [![Types included](https://img.shields.io/badge/types-included-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> JavaScript image compressor with server-side conversion for HEIC, TIFF, and camera RAW formats. The client-side compression uses the browser's native [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) method — **lossy**, **asynchronous**, and behaviour varies across browsers. Precompress images on the client side before uploading, with automatic server-assisted pre-conversion for formats browsers cannot natively read.

Built by [Alosha](https://alosha.dev) — privacy-first developer tools powered by open source.

- [▶ Live demo](https://pixsqueeze.alosha.dev/demo) · [Hosted Batch API](https://pixsqueeze.alosha.dev)

## Table of contents

- [Quick start](#quick-start)
- [Main Files](#main-files)
- [Getting started](#getting-started)
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

That's the whole API surface for the common case — pick a quality between `0` (smallest, lowest quality) and `1` (largest, original quality), get a compressed file back in `success`. Everything below shows how to handle more specific scenarios: resizing, converting formats, handling iPhone photos (HEIC), scans (TIFF), camera RAW files, watermarks, and more.

[⬆ back to top](#table-of-contents)

## Main Files

```text
dist/
├── pixsqueeze.js        (UMD)
├── pixsqueeze.min.js    (UMD, compressed)
├── pixsqueeze.common.js (CommonJS, default)
└── pixsqueeze.esm.js    (ES Module)
```

## Getting started

### Install

```shell
npm install @alosha/pixsqueeze
```

### Usage

#### Syntax

```js
new PixSqueeze(file[, options])
```

**file**

- Type: [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) or [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

The target image file for compressing.

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

      // The third parameter is required for server
      formData.append("file", result, result.name);

      // Send the compressed image file to server with XMLHttpRequest.
      fetch("/path/to/upload", { method: "POST", body: formData });
    },
    error(err) {
      console.log(err.message);
    },
  });
});
```

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

Force the output format regardless of the input — handy for standardizing what your server stores.

```js
new PixSqueeze(file, {
  mimeType: "image/webp", // or "image/jpeg", "image/png", "auto"
  quality: 0.75,
  success: (result) => console.log(result.type), // "image/webp"
});
```

> **Note:** Safari cannot encode to WebP via canvas. If you need guaranteed WebP output across all browsers, convert on the server instead.

### Compress an iPhone HEIC photo

Browsers can't decode HEIC/HEIF — the format iPhones save photos in by default. PixSqueeze ships a small server (in `server/`) that converts HEIC → JPEG first, then the client-side compressor takes over. The pattern: detect the format, send to the server if needed, then compress as usual.

```js
import PixSqueeze from "@alosha/pixsqueeze";

async function isHeic(file) {
  // A simple check — see `src/heic.js` for the full magic-byte detection used internally
  return file.type === "image/heic" || file.type === "image/heif" || /\.heic$|\.heif$/i.test(file.name);
}

async function convertHeicOnServer(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/convert/heic", { method: "POST", body: formData });

  if (!response.ok) {
    throw new Error("HEIC conversion failed");
  }

  const blob = await response.blob();

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

async function handleFile(file) {
  const resolvedFile = (await isHeic(file)) ? await convertHeicOnServer(file) : file;

  new PixSqueeze(resolvedFile, {
    quality: 0.6,
    success: (result) => console.log("Ready to upload:", result),
    error: (err) => console.error(err.message),
  });
}
```

> Run `npm run server` to start the bundled conversion server locally — see [Server-side conversion API](#server-side-conversion-api) for the full endpoint reference and ready-to-use detection helpers.

### Compress a TIFF or camera RAW file

Same idea as HEIC — these formats aren't readable by `<canvas>`, so they're routed through the server's `/api/convert/tiff` or `/api/convert/raw` endpoints first.

```js
async function convertOnServer(file, endpoint) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(endpoint, { method: "POST", body: formData });

  if (!response.ok) {
    throw new Error(`Conversion failed (${response.status})`);
  }

  const blob = await response.blob();

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

// Scanned document
const jpegFromTiff = await convertOnServer(tiffFile, "/api/convert/tiff");
new PixSqueeze(jpegFromTiff, { quality: 0.7, success: (r) => console.log(r) });

// Camera RAW (.cr2, .nef, .arw, .dng, etc. — see the full list in the API docs)
const jpegFromRaw = await convertOnServer(rawFile, "/api/convert/raw");
new PixSqueeze(jpegFromRaw, { quality: 0.7, success: (r) => console.log(r) });
```

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

An Express development server is bundled under `server/`. It serves the `docs/` demo page and exposes the server-side conversion API endpoints.

### Start the server

```shell
npm run server
```

Opens at `http://localhost:3000` by default. Set the `PORT` environment variable to override.

### Server dependencies

| Package        | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `express`      | HTTP server                                           |
| `multer`       | Multipart file upload handling (200 MB limit)         |
| `sharp`        | TIFF and RAW → JPEG conversion via libvips            |
| `heic-convert` | HEIC/HEIF → JPEG conversion (runs in a worker thread) |
| `compression`  | Gzip/Brotli for static assets and JSON responses      |

[⬆ back to top](#table-of-contents)

## Server-side conversion API

Browsers cannot natively decode HEIC, TIFF, or camera RAW files. The demo app sends these formats to the server, converts them to JPEG, and then feeds the result to the client-side compressor.

All endpoints accept a `multipart/form-data` POST with a single field named `file` and respond with:

- **`200`** — `image/jpeg` binary body + `X-Original-Name` header with the renamed filename
- **`400`** — No file uploaded or malformed request
- **`413`** — File exceeds the 200 MB upload limit
- **`415`** — File type not accepted by this endpoint
- **`422`** — Conversion failed (corrupt or unsupported variant)

### `POST /api/convert/heic`

Converts a HEIC/HEIF image to JPEG at quality 95. Detection is done by MIME type **and** ISO Base Media File Format magic bytes, so iOS files with an empty MIME type are handled correctly. Conversion runs in a dedicated worker thread to avoid blocking the Node.js event loop.

```shell
curl -X POST http://localhost:3000/api/convert/heic \
  -F "file=@photo.heic" \
  --output photo.jpg
```

### `POST /api/convert/tiff`

Converts a TIFF image (including multi-page TIFFs) to JPEG at quality 95. Detection uses MIME type, `.tiff`/`.tif` file extension, and little/big-endian magic bytes.

```shell
curl -X POST http://localhost:3000/api/convert/tiff \
  -F "file=@scan.tiff" \
  --output scan.jpg
```

### `POST /api/convert/raw`

Converts camera RAW files to JPEG at quality 95. Automatically applies embedded orientation metadata. Supported formats:

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

> **Note:** RAF and RW2 conversion requires the `sharp` binary to be built with LibRaw support. If your installed binary does not include it, the endpoint returns a `422` with a clear error message.

```shell
curl -X POST http://localhost:3000/api/convert/raw \
  -F "file=@DSC_0001.NEF" \
  --output DSC_0001.jpg
```

[⬆ back to top](#table-of-contents)

## Batch API

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

You may set compressor options with `new PixSqueeze(file, options)`.
If you want to change the global default options, You may use `PixSqueeze.setDefaults(options)`.

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
- The image's Exif information will be removed after compressed, so if you need the Exif information, you may need to upload the original image as well.

### retainExif

- Type: `boolean`
- Default: `false`

Indicates whether to retain the image's Exif information after compressed.

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

The quality of the output image. It must be a number between `0` and `1`. If this argument is anything else, the default values `0.92` and `0.80` are used for `image/jpeg` and `image/webp` respectively. Other arguments are ignored. Be careful to use `1` as it may make the size of the output image become larger.

**Note:** This option only available for `image/jpeg` and `image/webp` images.

> Check out the documentation of the [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) method for more detail.

**Examples**:

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

> **Note:** Safari does not support `mimeType` conversion to `"image/webp"`. For more details, see the [browser compatibility of the `HTMLCanvasElement.toBlob()` method](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#browser_compatibility).

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

The hook function to execute when successful to compress the image.

### error(err)

- Type: `Function`
- Default: `null`
- Parameters:
  - `err`: The compression error (an `Error` object).

The hook function executes when fails to compress the image.

[⬆ back to top](#table-of-contents)

## Methods

### abort()

Abort the compression process.

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
  PixSqueeze.noConflict();
  // Code that uses other `PixSqueeze` can follow here.
</script>
```

## Browser support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)
- Edge (latest)

## Contributing

Please read through our [contributing guidelines](.github/CONTRIBUTING.md).

## Versioning

Maintained under the [Semantic Versioning guidelines](https://semver.org/).

## License

[MIT](https://opensource.org/licenses/MIT) © Eduardo Silva Navarrete

---

Built by [Alosha](https://alosha.dev). PixSqueeze is part of the Alosha open-source portfolio — see the hosted offering at [pixsqueeze.alosha.dev](https://pixsqueeze.alosha.dev).

[⬆ back to top](#table-of-contents)
