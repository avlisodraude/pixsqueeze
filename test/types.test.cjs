const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

for (const mode of ['esm', 'commonjs', 'bundler']) {
  test(`published package declarations work for ${mode} consumers`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixsqueeze-types-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const pkgDir = path.join(dir, 'node_modules/@alosha/pixsqueeze');
    fs.mkdirSync(pkgDir, { recursive: true });
    for (const name of ['package.json', 'types', 'dist']) {
      fs.cpSync(path.join(root, name), path.join(pkgDir, name), { recursive: true });
    }
    const extension = { esm: 'mts', commonjs: 'cts', bundler: 'ts' }[mode];
    const filename = path.join(dir, `consumer.${extension}`);
    const importMain = mode === 'commonjs'
      ? 'import PixSqueeze = require("@alosha/pixsqueeze");'
      : 'import PixSqueeze from "@alosha/pixsqueeze";';
    fs.writeFileSync(filename, `${importMain}
import { isHeicFile, convertHeicOnServer } from '@alosha/pixsqueeze/heic';
import { isTiffFile } from '@alosha/pixsqueeze/tiff';
import { isRawFile } from '@alosha/pixsqueeze/raw';
const file = new File([], 'photo.jpg', { type: 'image/jpeg' });
const options: PixSqueeze.Options = { resize: 'cover', width: 100, quality: 0.8 };
new PixSqueeze(file, options).abort();
const RestoredPixSqueeze = PixSqueeze.noConflict();
new RestoredPixSqueeze(file, options);
const asyncOptions: PixSqueeze.AsyncOptions = {
  targetSize: 500000, maxAttempts: 8, minQuality: 0.4, allowResize: true,
  conversion: { heic: '/api/convert/heic', headers: { Authorization: 'example' } },
  signal: new AbortController().signal, timeout: 1000,
};
const result: Promise<PixSqueeze.CompressionResult> = PixSqueeze.compress(file, asyncOptions);
isHeicFile(file); isTiffFile(file); isRawFile(file);
convertHeicOnServer(file, '/convert', { signal: asyncOptions.signal });
// @ts-expect-error targetSize uses bytes, not a string.
PixSqueeze.compress(file, { targetSize: '500 KB' });
// @ts-expect-error resize only accepts the documented values.
new PixSqueeze(file, { resize: 'stretch' });
// @ts-expect-error async completion is returned by the Promise.
PixSqueeze.compress(file, { success() {} });
void result;
`);
    const program = ts.createProgram([filename], {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      target: ts.ScriptTarget.ES2022,
      module: mode === 'bundler' ? ts.ModuleKind.ESNext : ts.ModuleKind.NodeNext,
      moduleResolution: mode === 'bundler' ? ts.ModuleResolutionKind.Bundler : ts.ModuleResolutionKind.NodeNext,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => dir,
      getCanonicalFileName: (file) => file,
      getNewLine: () => '\n',
    }));
    // Verify that the declaration's module shape matches the actual package.
    const runtime = mode === 'commonjs'
      ? `const PixSqueeze = require('@alosha/pixsqueeze'); const { isHeicFile } = require('@alosha/pixsqueeze/heic');`
      : `import PixSqueeze from '@alosha/pixsqueeze'; import { isHeicFile } from '@alosha/pixsqueeze/heic';`;
    const runtimeFile = path.join(dir, mode === 'commonjs' ? 'runtime.cjs' : 'runtime.mjs');
    fs.writeFileSync(runtimeFile, `${runtime}\nif (typeof PixSqueeze !== 'function' || typeof PixSqueeze.compress !== 'function' || typeof isHeicFile !== 'function') throw new Error('Invalid package exports');`);
    execFileSync(process.execPath, [runtimeFile], { cwd: dir, stdio: 'pipe' });
  });
}
