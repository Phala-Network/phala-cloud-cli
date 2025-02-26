import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';

describe('TEE Cloud CLI End-to-End Tests', () => {
  const { runCommand, setup, teardown } = createTestEnvironment('cli');

  beforeAll(() => {
    setup();
  });

  afterAll(() => {
    teardown();
  });

  test('CLI shows help information', async () => {
    const { stdout, exitCode } = await runCommand(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Phala TEE Cloud CLI');
    expect(stdout).toContain('Commands:');
  });

  test('Config commands work correctly', async () => {
    // Set a config value
    const { exitCode: setExitCode } = await runCommand(['config', 'set', 'testKey', 'testValue']);
    expect(setExitCode).toBe(0);

    // Get the config value
    const { stdout: getStdout, exitCode: getExitCode } = await runCommand(['config', 'get', 'testKey']);
    expect(getExitCode).toBe(0);
    expect(getStdout).toContain('testKey: "testValue"');

    // List config values
    const { stdout: listStdout, exitCode: listExitCode } = await runCommand(['config', 'list']);
    expect(listExitCode).toBe(0);
    expect(listStdout).toContain('testKey');
    expect(listStdout).toContain('testValue');
  });

  test('Docker commands show help information', async () => {
    const { stdout, exitCode } = await runCommand(['docker', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Docker management commands');
    expect(stdout).toContain('login');
    expect(stdout).toContain('build');
    expect(stdout).toContain('push');
    expect(stdout).toContain('tags');
  });

  test('Simulator commands show help information', async () => {
    const { stdout, exitCode } = await runCommand(['simulator', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('TEE simulator commands');
    expect(stdout).toContain('start');
    expect(stdout).toContain('stop');
  });

  test('CVM commands show help information', async () => {
    const { stdout, exitCode } = await runCommand(['cvms', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Manage Cloud Virtual Machines');
  });
}); 