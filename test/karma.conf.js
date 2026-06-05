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
        name: rollupConfig.output[0].name,
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
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },
    client: {
      mocha: {
        timeout: 10000,
      },
    },
    coverageIstanbulReporter: {
      reports: ['html', 'lcovonly', 'text-summary'],
    },
    files: [
      'src/index.js',
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
      'src/index.js': ['rollup'],
      'test/helpers.js': ['rollup'],
      'test/specs/**/*.spec.js': ['rollup'],
    },
    reporters: ['mocha', 'coverage-istanbul'],
    singleRun: true,
  });
};
