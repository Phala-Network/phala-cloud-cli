import { execa } from 'execa';
import * as path from 'path';
import * as os from 'os';
import { createMockDir, deleteMockDir } from './mock';

const CLI_PATH = './dist/index.js';

/**
 * Creates a test environment for a specific test suite
 * @param testName The name of the test suite
 * @returns An object with the test environment
 */
export function createTestEnvironment(testName: string) {
  const testConfigDir = path.join(os.tmpdir(), `.phala-cloud-test-${testName}`);

  /**
   * Helper function to run CLI commands
   * @param args The command line arguments
   * @returns The command output
   */
  async function runCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execa('node', [CLI_PATH, ...args], {
        env: {
          TEE_CLOUD_CONFIG_DIR: testConfigDir,
        },
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.exitCode || 1,
      };
    }
  }

  /**
   * Sets up the test environment
   */
  function setup() {
    createMockDir(testConfigDir);
  }

  /**
   * Tears down the test environment
   */
  function teardown() {
    deleteMockDir(testConfigDir);
  }

  return {
    testConfigDir,
    runCommand,
    setup,
    teardown,
  };
} 