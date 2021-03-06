'use strict';

const { describe, it } = require('../../../../helpers/mocha');
const { expect } = require('../../../../helpers/chai');
const path = require('path');
const clearModule = require('clear-module');
const { runTests } = require('../../src');
const { promisify } = require('util');
const { afterEach } = require('mocha');
const tmpDir = promisify(require('tmp').dir);

describe(function() {
  describe(runTests, function() {
    let globs;
    let processEnv;

    beforeEach(function() {
      processEnv = { ...process.env };
    });

    afterEach(function() {
      // unfortunately, mocha caches previously run files,
      // even though it is a new instance...
      // https://github.com/mochajs/mocha/blob/v6.2.0/lib/mocha.js#L334
      clearModule.all();

      Object.assign(process.env, processEnv);
    });

    describe('tags', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/tag-test.js')];
      });

      it('works', async function() {
        let stats = await runTests({
          globs,
        });

        expect(stats.passes).to.equal(5);
      });

      it('works with a tag', async function() {
        let stats = await runTests({
          globs,
          tag: ['tag1'],
        });

        expect(stats.passes).to.equal(1);
      });

      it('ignores #', async function() {
        let stats = await runTests({
          globs,
          tag: ['#tag1'],
        });

        expect(stats.passes).to.equal(1);
      });

      it('works with an inverted tag', async function() {
        let stats = await runTests({
          globs,
          tag: ['!tag1'],
        });

        expect(stats.passes).to.equal(4);
      });

      it('does\'t match other tags when substring', async function() {
        let stats = await runTests({
          globs,
          tag: ['tag'],
        });

        expect(stats.passes).to.equal(1);
      });

      it('does\'t match other tags when substring - negated', async function() {
        let stats = await runTests({
          globs,
          tag: ['!tag'],
        });

        expect(stats.passes).to.equal(4);
      });
    });

    describe('filter', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/filter-test.js')];
      });

      it('works with a filter', async function() {
        let stats = await runTests({
          globs,
          filter: '#tag1',
        });

        expect(stats.passes).to.equal(1);
      });
    });

    describe('roles', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/role-test.js')];
      });

      it('works', async function() {
        let stats = await runTests({
          globs,
        });

        expect(stats.passes).to.equal(3);
      });

      it('works with a role', async function() {
        let stats = await runTests({
          globs,
          tag: ['role1'],
        });

        expect(stats.passes).to.equal(1);
      });

      it('works with an inverted role', async function() {
        let stats = await runTests({
          globs,
          tag: ['!role1'],
        });

        expect(stats.passes).to.equal(2);
      });
    });

    describe('feature flags', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/flag-test.js')];
      });

      it('works', async function() {
        let stats = await runTests({
          globs,
        });

        expect(stats.passes).to.equal(1);
      });
    });

    describe('retries', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/retries-test.js')];
      });

      it('works', async function() {
        let stats = await runTests({
          globs,
          retries: 1,
        });

        expect(stats.passes).to.equal(1);
      });
    });

    describe('reporter', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/reporter-test.js')];
      });

      beforeEach(async function() {
        this.output = path.join(await tmpDir(), 'output-test');
      });

      it('works', async function() {
        await runTests({
          globs,
          reporter: 'xunit',
          reporterOptions: `output=${this.output}`,
        });

        expect(this.output).to.be.a.file()
          .with.contents.that.match(/^<testsuite /);
      });
    });

    describe('failure artifacts', function() {
      before(function() {
        globs = [path.resolve(__dirname, '../fixtures/failure-artifacts-test.js')];
      });

      beforeEach(async function() {
        process.env.WEBDRIVER_FAILURE_ARTIFACTS = 'true';
        this.outputDir = process.env.WEBDRIVER_FAILURE_ARTIFACTS_OUTPUT_DIR = await tmpDir();
      });

      it('works', async function() {
        let stats = await runTests({
          globs,
          filter: 'it failure$',
        });

        expect(path.join(this.outputDir, 'failure artifacts it failure.png')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts it failure.html')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts it failure.browser.txt')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts it failure.driver.txt')).to.be.a.file();

        expect(stats.tests).to.equal(1);
        expect(stats.failures).to.equal(1);
      });

      it('doesn\'t make artifacts on test success', async function() {
        let stats = await runTests({
          globs,
          filter: 'it success$',
        });

        expect(this.outputDir).to.be.a.directory().and.empty;

        expect(stats.tests).to.equal(1);
        expect(stats.passes).to.equal(1);
      });

      it('doesn\'t make artifacts on it.skip', async function() {
        let stats = await runTests({
          globs,
          filter: 'it it\\.skip$',
        });

        expect(this.outputDir).to.be.a.directory().and.empty;

        expect(stats.tests).to.equal(1);
        expect(stats.pending).to.equal(1);
      });

      it('doesn\'t make artifacts on this.skip', async function() {
        this.skip();
        let stats = await runTests({
          globs,
          filter: 'it this\\.skip$',
        });

        expect(this.outputDir).to.be.a.directory().and.empty;

        expect(stats.tests).to.equal(1);
        expect(stats.pending).to.equal(1);
      });

      it('handles errors in beforeEach', async function() {
        let stats = await runTests({
          globs,
          filter: 'beforeEach failure$',
        });

        expect(path.join(this.outputDir, 'failure artifacts beforeEach failure.png')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts beforeEach failure.html')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts beforeEach failure.browser.txt')).to.be.a.file();
        expect(path.join(this.outputDir, 'failure artifacts beforeEach failure.driver.txt')).to.be.a.file();

        expect(stats.tests).to.equal(0);
        expect(stats.failures).to.equal(1);
      });
    });
  });
});
