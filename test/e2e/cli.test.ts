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
    const { stdout, exitCode } = await runCommand(['help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Phala Cloud CLI - Manage your Phala Cloud Deployments');
    expect(stdout).toContain('Commands:');
    expect(stdout).toContain('auth');
    expect(stdout).toContain('docker');
    expect(stdout).toContain('cvms');
    expect(stdout).toContain('simulator');
    expect(stdout).toContain('demo');
    expect(stdout).toContain('join');
  });

  test('Auth commands show help information', async () => {
    const { stdout, exitCode } = await runCommand(['auth', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Authenticate with Phala Cloud");
    expect(stdout).toContain("login");
    expect(stdout).toContain('logout');
    expect(stdout).toContain("status");
  });

  test('Docker commands show help information', async () => {
    const { stdout, exitCode } = await runCommand(['docker', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Login to Docker Hub and manage Docker images');
    expect(stdout).toContain('login');
    expect(stdout).toContain('build');
    expect(stdout).toContain('push');
    expect(stdout).toContain('generate');
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
    expect(stdout).toContain('Manage Phala Confidential Virtual Machines (CVMs)');
    expect(stdout).toContain("attestation");
    expect(stdout).toContain('create');
    expect(stdout).toContain('delete');
    expect(stdout).toContain("get");
    expect(stdout).toContain('start');
    expect(stdout).toContain('stop');
    expect(stdout).toContain('restart');
    expect(stdout).toContain("resize");
    expect(stdout).toContain("upgrade");
  });
  test('Free command show opens url to join', async () => {
    const { stdout, exitCode } = await runCommand(['free']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Brewing a fresh cup of TEE 🍵');
    expect(stdout).toContain('TEE is served! Opening Phala Cloud registration page.');
    expect(stdout).toContain('https://cloud.phala.network/register?invite=beta');
  });
}); 