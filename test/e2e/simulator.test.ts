import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';

describe('Simulator Commands E2E Tests', () => {
  const { runCommand, setup, teardown } = createTestEnvironment('simulator');

  beforeAll(() => {
    setup();
  });

  afterAll(() => {
    teardown();
  });

  test('Simulator start command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['simulator', 'start', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Start the TEE simulator');
    expect(stdout).toContain('--image');
  });

  test('Simulator stop command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['simulator', 'stop', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Stop the TEE simulator');
  });
}); 