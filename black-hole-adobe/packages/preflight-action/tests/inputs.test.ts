/**
 * Tests for action input parsing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setMockInput, resetMocks } from './__mocks__/actions-core';

vi.mock('@actions/core', () => import('./__mocks__/actions-core'));
vi.mock('@actions/github', () => import('./__mocks__/actions-github'));

import { parseInputs } from '../src/inputs';

describe('parseInputs', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should parse default inputs correctly', () => {
    const inputs = parseInputs();
    expect(inputs.failOn).toBe('critical');
    expect(inputs.scan).toBe('changed');
    expect(inputs.configFile).toBe('.preflightrc.json');
    expect(inputs.comment).toBe(true);
    expect(inputs.annotations).toBe(true);
    expect(inputs.sarifUpload).toBe(false);
  });

  it('should parse custom fail-on=major', () => {
    setMockInput('fail-on', 'major');
    const inputs = parseInputs();
    expect(inputs.failOn).toBe('major');
  });

  it('should parse fail-on=none', () => {
    setMockInput('fail-on', 'none');
    const inputs = parseInputs();
    expect(inputs.failOn).toBe('none');
  });

  it('should parse scan=all', () => {
    setMockInput('scan', 'all');
    const inputs = parseInputs();
    expect(inputs.scan).toBe('all');
  });

  it('should parse boolean inputs correctly (comment=false)', () => {
    setMockInput('comment', 'false');
    const inputs = parseInputs();
    expect(inputs.comment).toBe(false);
  });

  it('should parse sarif-upload=true', () => {
    setMockInput('sarif-upload', 'true');
    const inputs = parseInputs();
    expect(inputs.sarifUpload).toBe(true);
  });

  it('should throw on invalid fail-on value', () => {
    setMockInput('fail-on', 'invalid');
    expect(() => parseInputs()).toThrow('Invalid fail-on value "invalid"');
  });

  it('should throw on invalid scan value', () => {
    setMockInput('scan', 'partial');
    expect(() => parseInputs()).toThrow('Invalid scan value "partial"');
  });
});
