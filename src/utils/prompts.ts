import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Validates that a file exists at the given path
 * @param filePath Path to the file to validate
 * @param basePath Optional base path to resolve relative paths against (defaults to process.cwd())
 * @returns True if the file exists, throws an error if not
 * @throws Error if the file does not exist
 */
export function validateFileExists(
  filePath: string,
  basePath: string = process.cwd()
): boolean {
  const resolvedPath = path.resolve(basePath, filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found at ${resolvedPath}`);
  }
  return true;
}

/**
 * Prompts the user for a file path and validates that the file exists
 * @param message The prompt message to display
 * @param defaultValue The default value for the prompt
 * @param name The name of the prompt (used as property name in the returned object)
 * @param basePath Optional base path to resolve relative paths against (defaults to process.cwd())
 * @returns The validated file path
 */
export async function promptForFile(
  message: string,
  defaultValue: string,
  name: string = 'file',
  basePath: string = process.cwd()
): Promise<string> {
  const response = await inquirer.prompt([
    {
      type: 'input',
      name,
      message,
      default: defaultValue,
      validate: (input) => {
        const filePath = path.resolve(basePath, input);
        if (!fs.existsSync(filePath)) {
          return `File not found at ${filePath}`;
        }
        return true;
      }
    }
  ]);

  return response[name];
}

export function detectFileInCurrentDir(
  possibleFiles: string[],
  logMessage?: string
): string | undefined {
  for (const file of possibleFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      if (logMessage) {
        logger.info(logMessage.replace('{path}', filePath));
      } else {
        logger.info(`File detected: ${filePath}`);
      }
      return file;
    }
  }
  return undefined;
}