const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const {
  getMasterVersions,
  getLatestMasterResumePath,
  getMasterResumePath
} = require('../automation/master_manager');

test('TDD MasterManager: getMasterVersions should discover and sort all versions descending', () => {
  const versions = getMasterVersions();
  assert.ok(Array.isArray(versions), 'Should return an array');
  assert.ok(versions.length >= 3, 'Should discover at least v1, v2, v3');
  assert.strictEqual(versions[0].version, 'v3', 'Highest version should be v3');
  assert.strictEqual(versions[0].num, 3);
  assert.ok(fs.existsSync(versions[0].htmlPath), 'Html path must exist');
});

test('TDD MasterManager: getLatestMasterResumePath should resolve the latest version automatically', () => {
  const latestPath = getLatestMasterResumePath();
  assert.ok(latestPath.endsWith(path.join('v3', 'master_resume.html')), 'Should resolve to v3/master_resume.html');
  assert.ok(fs.existsSync(latestPath), 'Resolved master resume must exist on disk');
});

test('TDD MasterManager: getMasterResumePath should resolve a specific version when requested', () => {
  const v1Path = getMasterResumePath('v1');
  assert.ok(v1Path.endsWith(path.join('v1', 'master_resume.html')));
  assert.ok(fs.existsSync(v1Path));

  const v2Path = getMasterResumePath('v2');
  assert.ok(v2Path.endsWith(path.join('v2', 'master_resume.html')));
  assert.ok(fs.existsSync(v2Path));
});

test('TDD MasterManager: should respect MASTER_RESUME_VERSION environment variable if defined', () => {
  const originalEnv = process.env.MASTER_RESUME_VERSION;
  try {
    process.env.MASTER_RESUME_VERSION = 'v1';
    const envPath = getLatestMasterResumePath();
    assert.ok(envPath.endsWith(path.join('v1', 'master_resume.html')));
  } finally {
    if (originalEnv) {
      process.env.MASTER_RESUME_VERSION = originalEnv;
    } else {
      delete process.env.MASTER_RESUME_VERSION;
    }
  }
});
