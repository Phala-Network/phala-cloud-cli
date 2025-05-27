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

  // New tests based on the provided rules

  test('BASIC=basic rule', () => {
    const envFileContent = 'BASIC=basic';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'BASIC', value: 'basic' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('empty lines are skipped', () => {
    const envFileContent = `

VAR1=VALUE1

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

  test('lines beginning with # are comments', () => {
    const envFileContent = `#BASIC=basic
ACTUAL=value`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'ACTUAL', value: 'value' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('# marks beginning of a comment (unless value wrapped in quotes)', () => {
    const envFileContent = `KEY1=value1 # comment
KEY2="value2 # not a comment"
KEY3='value3 # not a comment'
KEY4=\`value4 # not a comment\`
KEY5=value5#notacomment # this is a comment
KEY6=value6 #comment with#hash
KEY7="value # with # hash"`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2 # not a comment' },
        { key: 'KEY3', value: 'value3 # not a comment' },
        { key: 'KEY4', value: 'value4 # not a comment' },
        { key: 'KEY5', value: 'value5#notacomment' },
        { key: 'KEY6', value: 'value6' },
        { key: 'KEY7', value: 'value # with # hash' }
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('empty values become empty strings', () => {
    const envFileContent = 'EMPTY=';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'EMPTY', value: '' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('inner quotes are maintained (JSON example)', () => {
    const envFileContent = 'JSON={\\"foo\\": \\"bar\\"}';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'JSON', value: '{\\"foo\\": \\"bar\\"}' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('whitespace removed from unquoted values', () => {
    const envFileContent = 'FOO=  some value  ';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'FOO', value: 'some value' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('single and double quoted values are escaped (content taken as is)', () => {
    const envFileContent = `SINGLE_QUOTE='quoted'
DOUBLE_QUOTE="quoted"`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'SINGLE_QUOTE', value: 'quoted' },
        { key: 'DOUBLE_QUOTE', value: 'quoted' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('single and double quoted values maintain whitespace', () => {
    const envFileContent = `FOO_DQ="  some value  "
FOO_SQ='  some value  '`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'FOO_DQ', value: '  some value  ' },
        { key: 'FOO_SQ', value: '  some value  ' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('double quoted values expand new lines', () => {
    const envFileContent = 'MULTILINE=\"new\\\\nline\"';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'MULTILINE', value: 'new\nline' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });
  
  test('single quoted values do NOT expand new lines', () => {
    const envFileContent = 'MULTILINE_SQ=\'new\\\\\\\\nline\'';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'MULTILINE_SQ', value: 'new\\\\\\\\nline' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('backticks are supported and maintain internal quotes', () => {
    const envFileContent = `BACKTICK_KEY=\`This has 'single' and \"double\" quotes inside of it.\``;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'BACKTICK_KEY', value: "This has 'single' and \"double\" quotes inside of it." },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('backtick quoted values maintain whitespace', () => {
    const envFileContent = 'BACKTICK_WS=\`  spaced out  \`';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'BACKTICK_WS', value: '  spaced out  ' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('backtick quoted values do NOT expand new lines', () => {
    const envFileContent = 'MULTILINE_BT=\`new\\\\\\\\nline\`';
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([{ key: 'MULTILINE_BT', value: 'new\\\\\\\\nline' }]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });

  test('should handle various complex cases', () => {
    const envFileContent = 
`# Start with a comment\n\nEMPTY_VALUE=\nBASIC_VALUE=basic # basic comment\n   SPACED_KEY   =   spaced value before comment #    comment with spaces\n\nSINGLE_QUOTED=\'  single quoted value with spaces and # hash  \'\nDOUBLE_QUOTED=\"  double quoted value with spaces and # hash and newline \\\\n next line \"\nBACKTICK_QUOTED=\`  backtick quoted value with spaces and # hash and newline \\\\\\\\n not expanded \`\nJSON_LIKE={\"key\": \"value with \\\"inner\\\" quotes\"} # json comment\n\n# Another comment\nWEIRD_CHARS=!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?\nWEIRD_QUOTES_DQ=\"!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?\"\nWEIRD_QUOTES_SQ=\'.!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?\'\nWEIRD_QUOTES_BT=\`!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?\`\nVALUE_WITH_HASH_IN_IT=foo#bar\nVALUE_WITH_HASH_AND_SPACE_BEFORE_IT=foo #bar is a comment now\n`;
    const tempFile = createTempFile(envFileContent);
    try {
      const result = parseEnv([], tempFile);
      expect(result).toEqual([
        { key: 'EMPTY_VALUE', value: '' },
        { key: 'BASIC_VALUE', value: 'basic' },
        { key: 'SPACED_KEY', value: 'spaced value before comment' },
        { key: 'SINGLE_QUOTED', value: '  single quoted value with spaces and # hash  ' },
        { key: 'DOUBLE_QUOTED', value: '  double quoted value with spaces and # hash and newline \n next line ' },
        { key: 'BACKTICK_QUOTED', value: '  backtick quoted value with spaces and # hash and newline \\\\\\\\n not expanded ' },
        { key: 'JSON_LIKE', value: '{\"key\": \"value with \\\"inner\\\" quotes\"}' },
        { key: 'WEIRD_CHARS', value: '!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?' },
        { key: 'WEIRD_QUOTES_DQ', value: '!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?' },
        { key: 'WEIRD_QUOTES_SQ', value: '.!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?' },
        { key: 'WEIRD_QUOTES_BT', value: '!@#$%^&*()_+-=[]{}\\\\;\\\\\\\':\\\\\\\",./<>?' },
        { key: 'VALUE_WITH_HASH_IN_IT', value: 'foo#bar' },
        { key: 'VALUE_WITH_HASH_AND_SPACE_BEFORE_IT', value: 'foo' },
      ]);
    } finally {
      cleanupTempFile(tempFile);
    }
  });
}); 