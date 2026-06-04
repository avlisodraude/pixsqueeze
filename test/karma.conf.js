const puppeteer = require('puppeteer');
const rollupConfig = require('../rollup.config');

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
    preprocessors: {
      'src/index.js': ['rollup'],
      'test/helpers.js': ['rollup'],
      'test/specs/**/*.spec.js': ['rollup'],
    },
    reporters: ['mocha', 'coverage-istanbul'],
    rollupPreprocessor: {
      plugins: rollupConfig.plugins,
      output: {
        format: 'iife',
        name: rollupConfig.output[0].name,
        sourcemap: 'inline',
      },
    },
    singleRun: true,
  });
};
