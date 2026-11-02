# Hosted Batch API recipes

These Node.js examples demonstrate the separate hosted service described in the [Batch API reference](../README.md#batch-api). They do not use the browser `PixSqueeze.compress()` API or the repository's `/api/convert/*` endpoints.

| Recipe | Source | Mock-mode output |
| --- | --- | --- |
| Compress and store uploads | [batch-compress/index.mjs](batch-compress/index.mjs) | Writes `upload.jpg` in the working directory and prints remaining quota. |
| Convert HEIC to WebP | [heic-to-webp/index.mjs](heic-to-webp/index.mjs) | Prints an illustrative data-URL image element. |

Use Node.js 24. Without `PIXSQUEEZE_KEY`, each script starts a temporary local HTTP mock with the expected response shape and closes it after completion. The requests and mock image bytes are placeholders: mock success verifies example wiring, not real image conversion, authentication, quota accounting, or service availability.

From the repository root, run with `PIXSQUEEZE_KEY` unset:

```shell
node examples/batch-compress/index.mjs
node examples/heic-to-webp/index.mjs
```

The first recipe creates a file, so choose a working directory where `upload.jpg` can be written. Do not treat that mock output as a decodable JPEG.

When a key is present, the scripts select the hosted URL. Before adapting them for live use, replace placeholder inputs with real image bytes, follow the service's current multipart/result contract, handle non-success HTTP responses and per-image errors, and keep API keys on your backend. The browser API's `targetSize`, `maxAttempts`, and `conversion` options are not implemented by these examples.

For runnable browser compression, target sizes, and explicit local HEIC/TIFF uploads, use the [local playground](../docs/README.md). For the static Promise API, see the [main README](../README.md#asynchronous-compression-and-target-sizes).
