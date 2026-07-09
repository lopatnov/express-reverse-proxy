/**
 * Unit tests for project configuration/manifest files changed in this PR:
 *   - biome.json          (schema bump, linter rules "recommended" -> "preset")
 *   - package.json        (dependency/devDependency version bumps)
 *   - package-lock.json   (lockfile kept in sync with package.json)
 *
 * These are plain Node.js tests using the built-in `node:test` runner, since
 * the repository has no unit-test framework configured (only Cypress e2e
 * tests, which require the demo servers to be running).
 *
 * Run with: node --test test/config.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readJson(relativePath) {
  const raw = fs.readFileSync(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw);
}

/**
 * Parses a simple "x.y.z" semver string into a tuple of numbers.
 */
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  assert.ok(match, `"${version}" is not a valid semver version`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compares two [major, minor, patch] tuples. Returns negative, zero or
 * positive, mirroring Array.prototype.sort comparator semantics.
 */
function compareVersionTuples(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Minimal caret-range check: `^x.y.z` allows any version >= x.y.z with the
 * same major version (the only range style used in this project's
 * dependencies/devDependencies).
 */
function satisfiesCaretRange(version, range) {
  assert.ok(range.startsWith('^'), `Expected a caret range, got "${range}"`);
  const rangeTuple = parseVersion(range.slice(1));
  const versionTuple = parseVersion(version);
  return versionTuple[0] === rangeTuple[0] && compareVersionTuples(versionTuple, rangeTuple) >= 0;
}

describe('biome.json', () => {
  const biomeConfig = readJson('biome.json');

  it('is valid JSON with the expected top-level keys', () => {
    assert.ok(biomeConfig.assist);
    assert.ok(biomeConfig.linter);
    assert.ok(biomeConfig.formatter);
    assert.ok(biomeConfig.files);
  });

  it('points $schema at the 2.5.1 schema version', () => {
    assert.equal(biomeConfig.$schema, 'https://biomejs.dev/schemas/2.5.1/schema.json');
  });

  it('$schema version matches the @biomejs/biome devDependency version', () => {
    const { devDependencies } = readJson('package.json');
    const schemaVersion = biomeConfig.$schema.match(/schemas\/([\d.]+)\/schema\.json/)[1];
    assert.equal(`^${schemaVersion}`, devDependencies['@biomejs/biome']);
  });

  it('configures the linter rules via the "preset" key', () => {
    assert.equal(biomeConfig.linter.rules.preset, 'recommended');
  });

  it('no longer uses the deprecated "recommended" boolean key for rules', () => {
    assert.equal(biomeConfig.linter.rules.recommended, undefined);
  });

  it('keeps the linter enabled', () => {
    assert.equal(biomeConfig.linter.enabled, true);
  });

  it('retains unrelated settings untouched by this PR', () => {
    assert.equal(biomeConfig.assist.actions.source.organizeImports, 'on');
    assert.equal(biomeConfig.formatter.enabled, true);
    assert.equal(biomeConfig.formatter.indentStyle, 'space');
    assert.equal(biomeConfig.formatter.indentWidth, 2);
    assert.equal(biomeConfig.formatter.lineWidth, 100);
    assert.equal(biomeConfig.javascript.formatter.quoteStyle, 'single');
    assert.deepEqual(biomeConfig.files.includes, [
      '**',
      '!node_modules',
      '!cypress/videos',
      '!cypress/screenshots',
    ]);
  });
});

describe('package.json dependency versions', () => {
  const pkg = readJson('package.json');

  const expectedDependencies = {
    'express-rate-limit': '^8.5.2',
    helmet: '^8.2.0',
    morgan: '^1.11.0',
    multer: '^2.2.0',
    pm2: '^7.0.3',
  };

  const expectedDevDependencies = {
    '@biomejs/biome': '^2.5.1',
    cypress: '^15.18.0',
  };

  for (const [name, range] of Object.entries(expectedDependencies)) {
    it(`bumps dependency "${name}" to ${range}`, () => {
      assert.equal(pkg.dependencies[name], range);
    });
  }

  for (const [name, range] of Object.entries(expectedDevDependencies)) {
    it(`bumps devDependency "${name}" to ${range}`, () => {
      assert.equal(pkg.devDependencies[name], range);
    });
  }

  it('does not remove any previously declared dependency keys', () => {
    const unaffectedDependencies = [
      'compression',
      'cors',
      'express',
      'express-basic-auth',
      'express-http-proxy',
      'response-time',
      'serve-favicon',
    ];
    for (const name of unaffectedDependencies) {
      assert.ok(name in pkg.dependencies, `expected "${name}" to still be a dependency`);
    }
  });

  it('declares every dependency and devDependency range as a valid caret semver range', () => {
    const allRanges = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, range] of Object.entries(allRanges)) {
      assert.match(range, /^\^\d+\.\d+\.\d+$/, `"${name}" has an unexpected range: "${range}"`);
    }
  });
});

describe('package-lock.json', () => {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');

  it('is valid JSON with a root package entry', () => {
    assert.ok(lock.packages);
    assert.ok(lock.packages['']);
  });

  it('root package name and version match package.json', () => {
    assert.equal(lock.name, pkg.name);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].name, pkg.name);
    assert.equal(lock.packages[''].version, pkg.version);
  });

  const bumpedDependencies = ['express-rate-limit', 'helmet', 'morgan', 'multer', 'pm2'];
  const bumpedDevDependencies = ['@biomejs/biome', 'cypress'];

  for (const name of bumpedDependencies) {
    it(`locks "${name}" to a version satisfying its package.json range`, () => {
      const range = pkg.dependencies[name];
      const lockedVersion = lock.packages[`node_modules/${name}`].version;
      assert.ok(
        satisfiesCaretRange(lockedVersion, range),
        `locked version "${lockedVersion}" does not satisfy range "${range}" for "${name}"`,
      );
    });
  }

  for (const name of bumpedDevDependencies) {
    it(`locks devDependency "${name}" to a version satisfying its package.json range`, () => {
      const range = pkg.devDependencies[name];
      const lockedVersion = lock.packages[`node_modules/${name}`].version;
      assert.ok(
        satisfiesCaretRange(lockedVersion, range),
        `locked version "${lockedVersion}" does not satisfy range "${range}" for "${name}"`,
      );
      assert.equal(lock.packages[`node_modules/${name}`].dev, true);
    });
  }

  it('mirrors the bumped dependency declaration in the root package entry', () => {
    for (const name of bumpedDependencies) {
      assert.equal(lock.packages[''].dependencies[name], pkg.dependencies[name]);
    }
    for (const name of bumpedDevDependencies) {
      assert.equal(lock.packages[''].devDependencies[name], pkg.devDependencies[name]);
    }
  });

  it('keeps the legacy flat "dependencies" section (lockfileVersion 2) in sync for bumped packages', () => {
    for (const name of [...bumpedDependencies, ...bumpedDevDependencies]) {
      const packagesVersion = lock.packages[`node_modules/${name}`].version;
      const legacyVersion = lock.dependencies[name].version;
      assert.equal(
        legacyVersion,
        packagesVersion,
        `legacy "dependencies" entry for "${name}" is out of sync with "packages"`,
      );
    }
  });
});

describe('satisfiesCaretRange helper (self-test)', () => {
  it('accepts a version equal to the range floor', () => {
    assert.equal(satisfiesCaretRange('8.5.2', '^8.5.2'), true);
  });

  it('accepts a version above the range floor within the same major', () => {
    assert.equal(satisfiesCaretRange('8.9.0', '^8.5.2'), true);
  });

  it('rejects a version below the range floor', () => {
    assert.equal(satisfiesCaretRange('8.5.1', '^8.5.2'), false);
  });

  it('rejects a version with a different major version', () => {
    assert.equal(satisfiesCaretRange('9.0.0', '^8.5.2'), false);
  });
});