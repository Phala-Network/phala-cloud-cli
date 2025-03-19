import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';

describe('CVM Commands E2E Tests', () => {
  const { runCommand, setup, teardown } = createTestEnvironment('cvms');

  beforeAll(() => {
    setup();
  });

  afterAll(() => {
    teardown();
  });

  test('CVM command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Manage Phala Confidential Virtual Machines (CVMs)');
  });

  test('CVM list command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'list', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('List all CVMs');
  });

  test('CVM create command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'create', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Create a new CVM');
  });

  test('CVM delete command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'delete', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Delete a CVM');
  });

  test('CVM start command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'start', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Start a stopped CVM');
  });

  test('CVM stop command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'stop', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Stop a running CVM');
  });

  test('CVM restart command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'restart', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Restart a CVM');
  });

  test('CVM info command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', 'get', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Get details of a CVM');
  });
}); 