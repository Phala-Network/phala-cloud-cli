import * as fs from 'fs';
import * as path from 'path';

/**
 * Creates a temporary mock file with the given content
 * @param filePath The path to the file
 * @param content The content to write to the file
 */
export function createMockFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

/**
 * Deletes a file if it exists
 * @param filePath The path to the file
 */
export function deleteMockFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Creates a temporary directory
 * @param dirPath The path to the directory
 */
export function createMockDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Deletes a directory if it exists
 * @param dirPath The path to the directory
 */
export function deleteMockDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
} 