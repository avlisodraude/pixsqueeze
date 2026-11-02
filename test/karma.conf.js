const puppeteer = require('puppeteer');
const rollup = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const path = require('path');
const rollupConfig = require('../rollup.config');

function createRollupPreprocessor(args, config, emitter, logger) {
  const log = logger.create('preprocessor.rollup');
  return async function preprocess(content, file, done) {
    const location = path.relative(config.basePath, file.originalPath);
    try {
      const bundle = await rollup.rollup({
        input: file.originalPath,
        plugins: [
          nodeResolve(),
          commonjs({ include: 'node_modules/**' }),
        ],
      });
      const { output } = await bundle.generate({
        format: 'iife',
        name: rollupConfig[0].output[0].name,
        sourcemap: false,
      });
      log.info('Generating bundle for ./%s', location);
      done(null, output[0].code);
    } catch (err) {
      log.error('Failed to process ./%s\n\n%s\n', location, err.stack);
      done(err, null);
    }
  };
}
createRollupPreprocessor.$inject = ['args', 'config', 'emitter', 'logger'];

module.exports = async (config) => {
  process.env.CHROME_BIN = await puppeteer.executablePath();
  config.set({
    autoWatch: false,
    basePath: '..',
    hostname: '127.0.0.1',
    listenAddress: '127.0.0.1',
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        // Use the same maintained headless flags as the playground checks,
        // including mock keychain access on macOS.
        base: 'Chrome',
        flags: [
          ...(await puppeteer.defaultArgs({ headless: true })).filter((arg) => arg !== 'about:blank'),
          '--no-sandbox',
          '--remote-debugging-port=0',
        ],
      },
    },
    client: {
      mocha: {
        timeout: 10000,
      },
    },
    files: [
      // Load the public UMD build for the callback and static Promise APIs.
      // ES module specs are independently bundled below.
      'dist/pixsqueeze.js',
      'test/helpers.js',
      'test/specs/**/*.spec.js',
      {
        pattern: 'docs/images/*',
        included: false,
      },
    ],
    frameworks: ['mocha', 'chai'],
    plugins: [
      'karma-*',
      { 'preprocessor:rollup': ['factory', createRollupPreprocessor] },
    ],
    preprocessors: {
      'test/helpers.js': ['rollup'],
      'test/specs/**/*.spec.js': ['rollup'],
    },
    reporters: ['mocha'],
    singleRun: true,
  });
};
