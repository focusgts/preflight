/**
 * Tests for PR changed file detection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setMockPRFiles,
  resetGithubMocks,
  context,
} from './__mocks__/actions-github';

vi.mock('@actions/core', () => import('./__mocks__/actions-core'));
vi.mock('@actions/github', () => import('./__mocks__/actions-github'));

import { getChangedFiles } from '../src/changed-files';

describe('getChangedFiles', () => {
  beforeEach(() => {
    resetGithubMocks();
  });

  it('should return supported files from PR', async () => {
    setMockPRFiles([
      { filename: 'src/main/java/Foo.java', status: 'modified' },
      { filename: 'src/main/resources/config.xml', status: 'added' },
      { filename: 'src/main/resources/osgi.cfg.json', status: 'modified' },
    ]);

    const files = await getChangedFiles('fake-token');
    expect(files).toEqual([
      'src/main/java/Foo.java',
      'src/main/resources/config.xml',
      'src/main/resources/osgi.cfg.json',
    ]);
  });

  it('should return empty array for non-PR context', async () => {
    context.payload = {};
    const files = await getChangedFiles('fake-token');
    expect(files).toEqual([]);
  });

  it('should filter out unsupported file types', async () => {
    setMockPRFiles([
      { filename: 'src/main/java/Foo.java', status: 'modified' },
      { filename: 'README.md', status: 'modified' },
      { filename: 'package.json', status: 'modified' },
      { filename: 'image.png', status: 'added' },
    ]);

    const files = await getChangedFiles('fake-token');
    expect(files).toEqual(['src/main/java/Foo.java']);
  });

  it('should skip removed files', async () => {
    setMockPRFiles([
      { filename: 'src/main/java/Foo.java', status: 'modified' },
      { filename: 'src/main/java/Deleted.java', status: 'removed' },
    ]);

    const files = await getChangedFiles('fake-token');
    expect(files).toEqual(['src/main/java/Foo.java']);
  });

  it('should handle pagination (>100 files)', async () => {
    const manyFiles = Array.from({ length: 150 }, (_, i) => ({
      filename: `src/File${i}.java`,
      status: 'modified',
    }));
    setMockPRFiles(manyFiles);

    const files = await getChangedFiles('fake-token');
    expect(files).toHaveLength(150);
  });
});
