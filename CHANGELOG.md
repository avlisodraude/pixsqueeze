# Changelog

## Unreleased

No unreleased changes.

## 1.5.0 (Nov 2, 2026)

- Fix package TypeScript declarations for ESM, CommonJS, and bundler consumers.
- Add native `.esm.mjs` import entries and matching `.d.mts`/`.d.cts` declarations while retaining legacy bundles. Correct the constructor return type of `noConflict()`.
- Serve a self-contained local playground at the demo server root while keeping the static-host redirect.
- Add `PixSqueeze.compress()` with Promise results, explicit server conversion endpoints, cancellation, and timeouts.
- Add bounded target-size compression with optional dimension reduction and an explicit `targetMet` result.
- Return output bytes, actual MIME type, dimensions, encoding attempts, server-conversion status, and original-file fallback information from the static API. Targets use bytes and default to at most eight attempts; an unmet target returns the smallest result found rather than claiming success.
- Allow request headers, credentials, and cancellation in the existing server conversion helpers.
- Check browser flows, package types, and server behavior in CI.
- Convert `.heif` filenames to `.jpg` on the HEIC endpoint and prevent late image errors from notifying cancelled jobs twice.
- Apply compatible dependency security updates, upgrade Sharp to the patched 0.35 line, and pin patched nested dependencies. Keep remaining tooling audit findings distinct from server-path risk.
- Configure Node.js globals for examples and align headless Chrome startup with Puppeteer defaults.
- Refresh API/reference documentation, local examples, contribution/testing instructions, and the roadmap's implementation status. Includes release validation before the tag-triggered npm publication.

## 1.3.4 (Jun 14, 2026)

- Remove server-only packages (`express`, `sharp`, `multer`, `heic-convert`, `compression`) from runtime `dependencies` — they are used only by the local demo `server/` and are now `devDependencies`. The published browser library has **zero** runtime dependencies, which drops install size and clears the supply-chain alerts those transitive trees produced.

## 1.3.3 (Jun 13, 2026)

- Point `homepage` to the new live demo at `pixsqueeze.alosha.dev/demo`; the GitHub Pages demo now redirects there.
- README leads with a live-demo link alongside the hosted Batch API.

## 1.3.2 (Jun 13, 2026)

- Rebrand to PixSqueeze under the Alosha studio. Update `repository` and `homepage` to `github.com/avlisodraude/pixsqueeze` and `pixsqueeze.alosha.dev`.
- Retire the CompressMe identity across the README, docs site, and bundle banners; add "Built by Alosha" messaging.

## 1.3.0 (Apr 6, 2026)

- Convert the resulting Blob object into a File object for modern browsers (#146).
- Output the original image when `canvas.getContext('2d').getImageData()` is unavailable in Firefox's `privacy.resistFingerprinting` mode (#177).

## 1.2.1 (Feb 28, 2023)

- Fix incompatible syntax in the bundled files (#170).

## 1.2.0 (Feb 25, 2023)

- Add a new option: `retainExif` (#159).

## 1.1.1 (Oct 5, 2021)

- Fix loading error in Node.js (#137).

## 1.1.0 (Oct 1, 2021)

- Add 2 new options: `convertTypes` (#123) and `resize` (#130).
- Ignore the `strict` option when the `maxWidth/Height` option is set and its value is less than the natural width/height of the image (#134).
.

## 1.0.7 (Nov 28, 2020)

- Update the built-in dependencies for better adaptability.

## 1.0.6 (Nov 23, 2019)

- Fix the `The operation is insecure` error (#57).

## 1.0.5 (Jan 23, 2019)

- Fix the wrong generated URL when the given image's orientation is 1 (#64).

## 1.0.4 (Jan 19, 2019)

- Regenerate the initial URL only when the orientation was reset for better performance (#63).

## 1.0.3 (Dec 18, 2018)

- Convert `TypedArray` to `Array` manually instead of using Babel helpers for better browser compatibility (#60).

## 1.0.2 (Dec 10, 2018)

- Upgrade `is-blob` to v2.
- Move `examples` folder to `docs` folder.

## 1.0.1 (Oct 24, 2018)

- Simplify the state of canvas for the `beforeDraw` option.
- Ignore range error when the image does not have correct Exif information.

## 1.0.0 (Oct 15, 2018)

- Supports 15 options: `beforeDraw`, `checkOrientation`, `convertSize`, `drew`, `error`, `height`, `maxHeight`, `maxWidth`, `mimeType`, `minHeight`, `minWidth`, `quality`, `strict`, `success` and `width`.
- Support 1 method: `abort`.
- Support to compress images of `File` or `Blob` object.
- Supports to translate Exif Orientation information.
