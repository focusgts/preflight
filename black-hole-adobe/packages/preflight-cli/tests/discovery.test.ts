/**
 * File Discovery Tests
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { discoverFiles } from '../src/discovery/file-discovery';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('File Discovery', () => {
  it('finds .java files in a project directory', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'bad-project')],
      {}
    );
    const javaFiles = files.filter((f) => f.endsWith('.java'));
    expect(javaFiles.length).toBeGreaterThanOrEqual(3);
  });

  it('finds .xml files in a project directory', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'bad-project')],
      {}
    );
    const xmlFiles = files.filter((f) => f.endsWith('.xml'));
    expect(xmlFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('respects include config filters', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'bad-project')],
      { include: ['**/*.xml'] }
    );
    expect(files.every((f) => f.endsWith('.xml'))).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('respects exclude config filters', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'bad-project')],
      { exclude: ['**/*.xml'] }
    );
    expect(files.every((f) => !f.endsWith('.xml'))).toBe(true);
  });

  it('returns empty array for non-existent path', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'non-existent-dir')],
      {}
    );
    expect(files).toEqual([]);
  });

  it('finds files in clean project', async () => {
    const files = await discoverFiles(
      [path.join(FIXTURES, 'clean-project')],
      {}
    );
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
