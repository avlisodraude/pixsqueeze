const terser = require('@rollup/plugin-terser');
const commonjs = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const pkg = require('./package.json');

const libName = pkg.name.replace(/^@[^/]+\//, '');
const name = 'PixSqueeze';
const banner = `/*!
 * ${name}.js v${pkg.version}
 * ${pkg.homepage}
 *
 * Copyright 2018-present ${pkg.author.name}
 * Released under the ${pkg.license} license
 *
 * Date: ${new Date().toISOString()}
 */`;

module.exports = {
  input: 'src/index.js',
  output: [
    {
      banner,
      name,
      file: `dist/${libName}.js`,
      format: 'umd',
    },
    {
      banner,
      file: `dist/${libName}.common.js`,
      format: 'cjs',
      exports: 'auto',
    },
    {
      banner,
      file: `dist/${libName}.esm.js`,
      format: 'esm',
    },
    {
      banner,
      name,
      file: `dist/${libName}.min.js`,
      format: 'umd',
      plugins: [terser({ format: { comments: /^!/ } })],
    },
    {
      banner,
      name,
      file: `docs/js/${libName}.js`,
      format: 'umd',
    },
  ],
  plugins: [
    nodeResolve(),
    commonjs({ include: 'node_modules/**' }),
  ],
};
