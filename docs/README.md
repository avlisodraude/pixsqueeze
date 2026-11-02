# PixSqueeze documentation and examples

The [main README](../README.md) is the public API reference. Its [asynchronous API guide](../README.md#asynchronous-compression-and-target-sizes) covers byte targets, result fields, conversion endpoints, cancellation, and timeouts. See [TypeScript usage](../README.md#typescript) for import and declaration support.

## Run the local documentation

Use Node.js 24, then run these commands from the repository root:

```shell
npm ci
npm run build
npm run server
```

Open `http://localhost:3000`. For a different port, use `PORT=4173 npm run server` and open `http://localhost:4173`. The root serves [local.html](local.html), which uses local CSS and the built UMD library without a CDN. It offers image selection, output format, quality, maximum width, a target size in decimal KB, optional resizing, cancellation, previews, and download links. One KB in this UI is 1,000 bytes; the API's `targetSize` always uses bytes.

JPEG/PNG/WebP work stays in the browser. HEIC/TIFF/RAW conversion requires the upload checkbox, uses this server's `/api/convert/*` endpoints, and returns an intermediate JPEG. Camera RAW recognition does not guarantee decoder support. An unattainable target leaves the best result available with an explicit status message.

`index.html` intentionally redirects static-host visitors to the hosted demo. It is not the local playground. Open these pages through the local HTTP server rather than from a `file://` URL.

## Browser examples

| URL on the local server | Example source | API illustrated |
| --- | --- | --- |
| `/examples/work-with-promise.html` | [Promise example](examples/work-with-promise.html) | `PixSqueeze.compress()`, a byte target, Promise errors, and output metadata. |
| `/examples/watermark.html` | [Watermark example](examples/watermark.html) | Existing callback constructor and `drew` hook. |
| `/examples/grayscale.html` | [Grayscale example](examples/grayscale.html) | Existing callback constructor and `beforeDraw` hook. |

Browser examples use the local generated bundle. Run `npm run build` after library edits, or keep `npm run dev` running in a second terminal. `npm start` starts that build watcher; it does not start the HTTP server.

## Other documentation

- [Hosted Batch API examples](../examples/README.md): separate Node recipes with a credential-free mock mode, not local conversion routes.
- [Contributor guide](../.github/CONTRIBUTING.md#development-setup-and-verification): environment, source ownership, verification, packaging, and security audits.
- [Changelog](../CHANGELOG.md): version 1.5.0 records the new implementation.
- [Monetization roadmap](../MONETIZATION_ROADMAP.md): repository implementation status followed by historical plans.

The test suites exercise the local build and fixtures. They do not confirm a hosted rollout, billing behavior, arbitrary RAW-camera support, or physical-device acceptance.
