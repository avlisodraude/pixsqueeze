# Compressme

[![Coverage Status](https://img.shields.io/codecov/c/github/avlisodraude/compressme.svg)](https://codecov.io/gh/avlisodraude/compressme) [![Downloads](https://img.shields.io/npm/dm/compressme.svg)](https://www.npmjs.com/package/compressme) [![Version](https://img.shields.io/npm/v/compressme.svg)](https://www.npmjs.com/package/compressme) [![Gzip Size](https://img.shields.io/bundlephobia/minzip/compressme.svg)](https://unpkg.com/compressme/dist/compressme.common.js)

> JavaScript image compressor with server-side conversion for HEIC, TIFF, and camera RAW formats. The client-side compression uses the browser's native [HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) method — **lossy**, **asynchronous**, and behaviour varies across browsers. Precompress images on the client side before uploading, with automatic server-assisted pre-conversion for formats browsers cannot natively read.

- [Website](https://avlisodraude.github.io/compressme)

## Table of contents

- [Main Files](#main-files)
- [Getting started](#getting-started)
- [Demo server](#demo-server)
- [Server-side conversion API](#server-side-conversion-api)
- [Options](#options)
- [Methods](#methods)
- [No conflict](#no-conflict)
- [Browser support](#browser-support)
- [Contributing](#contributing)
- [Versioning](#versioning)
- [License](#license)

## Main Files

```text
dist/
├── compressme.js        (UMD)
├── compressme.min.js    (UMD, compressed)
├── compressme.common.js (CommonJS, default)
└── compressme.esm.js    (ES Module)
```

## Getting started

### Install

```shell
npm install compressme
```

### Usage

#### Syntax

```js
new Compressor(file[, options])
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
import Compressor from "compressme";

document.getElementById("file").addEventListener("change", (e) => {
  const file = e.target.files[0];

  if (!file) {
    return;
  }

  new Compressor(file, {
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

## Options

You may set compressor options with `new Compressor(file, options)`.
If you want to change the global default options, You may use `Compressor.setDefaults(options)`.

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
new Compressor(file, {
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
new Compressor(file, {
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
const compressor = new Compressor(file);

// Do something...
compressor.abort();
```

## No conflict

If you have to use another compressor with the same namespace, just call the `Compressor.noConflict` static method to revert to it.

```html
<script src="other-compressor.js"></script>
<script src="compressor.js"></script>
<script>
  Compressor.noConflict();
  // Code that uses other `Compressor` can follow here.
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

[⬆ back to top](#table-of-contents)
