import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      vscode: path.resolve(__dirname, 'tests/__mocks__/vscode.ts'),
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'tests/__mocks__/vscode.ts'),
    },
  },
});
