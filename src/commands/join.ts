import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { execSync } from 'node:child_process';
import * as os from 'node:os';
import { logo } from '../utils/banner';


/**
 * Opens a URL in the default web browser based on the current operating system
 * @param url The URL to open
 */
function openBrowser(url: string): void {
  const platform = os.platform();
  
  try {
    switch (platform) {
      case 'darwin': // macOS
        execSync(`open "${url}"`);
        break;
      case 'win32': // Windows
        execSync(`start "" "${url}"`);
        break;
      case 'linux': // Linux
        // Try different commands in order
        try {
          execSync(`xdg-open "${url}"`);
        } catch (error) {
          try {
            execSync(`gnome-open "${url}"`);
          } catch (error) {
            execSync(`kde-open "${url}"`);
          }
        }
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
    logger.success(`Opened URL in your default browser: ${url}`);
  } catch (error) {
    logger.error(`Failed to open URL: ${error instanceof Error ? error.message : String(error)}`);
    logger.info(`Please manually open this URL in your browser: ${url}`);
  }
}

/**
 * Pauses execution for the specified number of milliseconds
 * @param {number} ms - Time to sleep in milliseconds
 * @returns {Promise} Promise that resolves after the specified time
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const joinCommand = new Command()
  .name('join')
  .alias('free')
  .description('Join Phala Cloud! Get an account and deploy a CVM for FREE')
  .action(async () => {
    try {
      const inviteUrl = 'https://cloud.phala.network/register?invite=PHALACLI';
      const spinner =logger.startSpinner('Brewing a fresh cup of TEE 🍵');
      await sleep(2000);
      spinner.stop(true);
      logger.break();
      logger.break();
      console.log(logo);
      logger.info('TEE is served! Opening Phala Cloud registration page...');
      await sleep(1000);
      logger.break()
      openBrowser(inviteUrl);
    } catch (error) {
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 