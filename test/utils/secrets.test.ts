import { parseEnv } from '../../src/utils/secrets';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
// Assuming bun test provides Jest-like globals, otherwise, you might need:
// import { describe, test, expect, afterEach } from '@jest/globals';

// Helper to create a temporary file for testing
const createTempFile = (content: string): string => {
  const tempDir = os.tmpdir();
  // Using Date.now() to ensure unique filenames for parallel tests or quick reruns
  const tempFilePath = path.join(tempDir, `test-env-${Date.now()}-${Math.random().toString(36).substring(2,7)}.env`);
  fs.writeFileSync(tempFilePath, content);
  return tempFilePath;
};

// Helper to clean up temporary files
const cleanupTempFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error cleaning up temp file ${filePath}:`, error);
    // Potentially ignore cleanup errors in a test environment or log them
  }
};

describe('parseEnv', () => {
  test('should parse direct environment variables', () => {
    const envs = ['VAR1=VALUE1', 'VAR2=VALUE2'];
    const result = parseEnv(envs, '');
    expect(result).toEqual([
      { key: 'VAR1', value: 'VALUE1' },
      { key: 'VAR2', value: 'VALUE2' },
    ]);
  });

  test('should handle empty environment variables array and no file', () => {
    const result = parseEnv([], '');
    expect(result).toEqual([]);
  });

  test('should parse environment variables from file without quotes', () => {
    const envFileContent = `VAR1=VALUE1
VAR2=VALUE2
VAR3=VALUE 3`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'VALUE1' },
        { key: 'VAR2', value: 'VALUE2' },
        { key: 'VAR3', value: 'VALUE 3' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should strip double quotes from values in environment file', () => {
    const envFileContent = `VAR1="VALUE1"
VAR2="VALUE 2"
VAR3=VALUE3`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'VALUE1' },
        { key: 'VAR2', value: 'VALUE 2' },
        { key: 'VAR3', value: 'VALUE3' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should strip single quotes from values in environment file', () => {
    const envFileContent = `VAR1='VALUE1'
VAR2='VALUE 2'
VAR3=VALUE3`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'VALUE1' },
        { key: 'VAR2', value: 'VALUE 2' },
        { key: 'VAR3', value: 'VALUE3' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should handle inline comments correctly', () => {
    const envFileContent = `VAR1=VALUE1 # this is a comment
VAR2="VALUE2" # comment with quotes
VAR3=VALUE3`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'VALUE1' },
        { key: 'VAR2', value: 'VALUE2' },
        { key: 'VAR3', value: 'VALUE3' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should skip comment lines and empty lines', () => {
    const envFileContent = `# This is a comment
VAR1=VALUE1

# Another comment
VAR2=VALUE2
`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'VALUE1' },
        { key: 'VAR2', value: 'VALUE2' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should combine direct envs and file envs, with file envs taking precedence for duplicates', () => {
    const envs = ['DIRECT_VAR=DIRECT_VALUE', 'VAR1=FROM_DIRECT'];
    const envFileContent = `FILE_VAR="FILE_VALUE"
VAR1=FROM_FILE`; // VAR1 in file should override VAR1 from direct envs
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv(envs, tempFile);
      expect(result).toContainEqual({ key: 'DIRECT_VAR', value: 'DIRECT_VALUE' });
      expect(result).toContainEqual({ key: 'FILE_VAR', value: 'FILE_VALUE' });
      expect(result).toContainEqual({ key: 'VAR1', value: 'FROM_FILE' });
      expect(result.filter(e => e.key === 'VAR1').length).toBe(1); // Ensure VAR1 is not duplicated
      expect(result).toHaveLength(3);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should handle values with equals signs', () => {
    const envFileContent = `VAR1="value=with=equals"
VAR2=value=with=equals`;
    const tempFile = createTempFile(envFileContent);
    
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'VAR1', value: 'value=with=equals' },
        { key: 'VAR2', value: 'value=with=equals' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should handle empty file', () => {
    const tempFile = createTempFile('');
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });
  
  test('should handle file with only comments and empty lines', () => {
    const envFileContent = `# comment 1
    
# comment 2`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });
}); 