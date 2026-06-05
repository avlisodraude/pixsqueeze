const { babel } = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');
const pkg = require('./package.json');

const libName = pkg.name.replace('js', '');
const name = libName.charAt(0).toUpperCase() + libName.slice(1);
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
      file: `docs/js/${libName}.js`,
      format: 'umd',
    },
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
    }),
    replace({
      delimiters: ['', ''],
      exclude: ['node_modules/**'],
      preventAssignment: true,
      '(function (module) {': `(function (module) {
  if (typeof window === 'undefined') {
    return;
  }`,
    }),
  ],
};
