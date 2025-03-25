import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';
import { createMockFile } from '../utils/mock';
import * as path from 'path';

describe('Docker Commands E2E Tests', () => {
  const { runCommand, setup, teardown, testConfigDir } = createTestEnvironment('docker');
  const TEST_CREDENTIALS_FILE = path.join(testConfigDir, 'credentials.json');

  beforeAll(() => {
    setup();
    
    // Create mock Docker credentials
    const credentials = {
      username: 'testuser',
      password: 'testpassword',
      registry: null
    };
    createMockFile(TEST_CREDENTIALS_FILE, JSON.stringify(credentials));
  });

  afterAll(() => {
    teardown();
  });

  test('Docker login command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['docker', 'login', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Login to Docker Hub');
    expect(stdout).toContain('--username');
    expect(stdout).toContain('--password');
    expect(stdout).toContain('--registry');
  });

  test('Docker build command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['docker', 'build', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Build a Docker image');
    expect(stdout).toContain('--image');
    expect(stdout).toContain('--tag');
    expect(stdout).toContain('--file');
  });

  test('Docker push command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['docker', 'push', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Push a Docker image to Docker Hub');
    expect(stdout).toContain('--image');
  });

  test('Docker generate command shows help', async () => {
    const { stdout, exitCode } = await runCommand(['docker', 'generate', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Generate a Docker Compose file');
    expect(stdout).toContain('--image');
    expect(stdout).toContain('--env-file');
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--template');
  });
}); 