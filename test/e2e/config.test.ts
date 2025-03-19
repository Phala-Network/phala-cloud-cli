import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';

describe('Config Commands E2E Tests', () => {
  const { runCommand, setup, teardown } = createTestEnvironment('config');

  beforeAll(() => {
    setup();
  });

  afterAll(() => {
    teardown();
  });

  test('Set and get a string config value', async () => {
    // Set a config value
    const { exitCode: setExitCode } = await runCommand(['config', 'set', 'testString', 'hello world']);
    expect(setExitCode).toBe(0);

    // Get the config value
    const { stdout: getStdout, exitCode: getExitCode } = await runCommand(['config', 'get', 'testString']);
    expect(getExitCode).toBe(0);
    expect(getStdout).toContain('testString: "hello world"');
  });

  test('Set and get a numeric config value', async () => {
    // Set a config value
    const { exitCode: setExitCode } = await runCommand(['config', 'set', 'testNumber', '42']);
    expect(setExitCode).toBe(0);

    // Get the config value
    const { stdout: getStdout, exitCode: getExitCode } = await runCommand(['config', 'get', 'testNumber']);
    expect(getExitCode).toBe(0);
    expect(getStdout).toContain('testNumber: 42');
  });

  test('Set and get a boolean config value', async () => {
    // Set a config value
    const { exitCode: setExitCode } = await runCommand(['config', 'set', 'testBoolean', 'true']);
    expect(setExitCode).toBe(0);

    // Get the config value
    const { stdout: getStdout, exitCode: getExitCode } = await runCommand(['config', 'get', 'testBoolean']);
    expect(getExitCode).toBe(0);
    expect(getStdout).toContain('testBoolean: true');
  });

  test('Set and get a JSON config value', async () => {
    // Set a config value
    const { exitCode: setExitCode } = await runCommand(['config', 'set', 'testJson', '{"key":"value","nested":{"array":[1,2,3]}}']);
    expect(setExitCode).toBe(0);

    // Get the config value
    const { stdout: getStdout, exitCode: getExitCode } = await runCommand(['config', 'get', 'testJson']);
    expect(getExitCode).toBe(0);
    expect(getStdout).toContain('testJson:');
    expect(getStdout).toContain('"key":"value"');
    expect(getStdout).toContain('"nested":{"array":[1,2,3]}');
  });

  test('List config values', async () => {
    // List config values
    const { stdout: listStdout, exitCode: listExitCode } = await runCommand(['config', 'list']);
    expect(listExitCode).toBe(0);
    expect(listStdout).toContain('testString');
    expect(listStdout).toContain('testNumber');
    expect(listStdout).toContain('testBoolean');
    expect(listStdout).toContain('testJson');
  });

  test('List config values in JSON format', async () => {
    // List config values in JSON format
    const { stdout: listStdout, exitCode: listExitCode } = await runCommand(['config', 'list', '--json']);
    expect(listExitCode).toBe(0);
    
    // Parse the JSON output
    const config = JSON.parse(listStdout);
    expect(config.testString).toBe('hello world');
    expect(config.testNumber).toBe(42);
    expect(config.testBoolean).toBe(true);
    expect(config.testJson.key).toBe('value');
    expect(config.testJson.nested.array).toEqual([1, 2, 3]);
  });

  test('Get a non-existent config value', async () => {
    // Get a non-existent config value
    const { stderr: getStderr, exitCode: getExitCode } = await runCommand(['config', 'get', 'nonExistentKey']);
    expect(getExitCode).toBe(1);
    expect(getStderr).toContain('not found');
  });
}); 