/**
 * Mock for @actions/core
 */

const inputs: Record<string, string> = {};
const outputs: Record<string, string> = {};
const errors: Array<{ message: string; properties?: Record<string, unknown> }> = [];
const warnings: Array<{ message: string; properties?: Record<string, unknown> }> = [];
const notices: Array<{ message: string; properties?: Record<string, unknown> }> = [];
const infos: string[] = [];
let failedMessage: string | null = null;

export function setMockInput(name: string, value: string): void {
  inputs[name] = value;
}

export function resetMocks(): void {
  for (const key of Object.keys(inputs)) delete inputs[key];
  for (const key of Object.keys(outputs)) delete outputs[key];
  errors.length = 0;
  warnings.length = 0;
  notices.length = 0;
  infos.length = 0;
  failedMessage = null;
}

export function getMockOutputs(): Record<string, string> {
  return { ...outputs };
}

export function getMockErrors() {
  return [...errors];
}

export function getMockWarnings() {
  return [...warnings];
}

export function getMockNotices() {
  return [...notices];
}

export function getMockInfos(): string[] {
  return [...infos];
}

export function getMockFailed(): string | null {
  return failedMessage;
}

// --- @actions/core API ---

export function getInput(name: string): string {
  return inputs[name] ?? '';
}

export function setOutput(name: string, value: string): void {
  outputs[name] = value;
}

export function setFailed(message: string): void {
  failedMessage = message;
}

export function error(
  message: string,
  properties?: Record<string, unknown>
): void {
  errors.push({ message, properties });
}

export function warning(
  message: string,
  properties?: Record<string, unknown>
): void {
  warnings.push({ message, properties });
}

export function notice(
  message: string,
  properties?: Record<string, unknown>
): void {
  notices.push({ message, properties });
}

export function info(message: string): void {
  infos.push(message);
}
