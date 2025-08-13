import { createClient } from '@phala/cloud';
import { Command } from 'commander';
import { getApiKey } from '../utils/credentials.js';
import { logger } from '../utils/logger.js';
import { safeGetCurrentUser } from '@phala/cloud';

export async function checkStatus(options: { debug?: boolean; json?: boolean } = {}) {
  try {
    // Check debug flag from either options or environment
    const debug = options.debug || process.env.DEBUG?.toLowerCase() === 'true';

    const apiKey = getApiKey();

    if (!apiKey) {
      logger.warn('Not authenticated. Please set an API key with "phala auth login"');
      return;
    }

    if (debug) {
      logger.debug(`Using API key: ${apiKey.substring(0, 5)}...`);
    }

    try {
      const apiClient = createClient();
      const result = await safeGetCurrentUser(apiClient);

      if (!result.success) {
        logger.error('Failed to get user information');
        if (result.error) {
          logger.error(`Error: ${result.error.message}`);
        }
        return;
      }

      const userInfo = result.data as any;
      const apiUrl = process.env.PHALA_CLOUD_API_PREFIX || 'https://cloud-api.phala.network/api/v1';

      if (options.json) {
        console.log(JSON.stringify({
          apiUrl,
          username: userInfo.username,
          team_name: userInfo.team_name
        }, null, 2));
        return;
      }
      // Display the status in the requested format without colors
      console.log(`Integrated API: ${apiUrl}`);
      console.log(`Logged in as: ${userInfo.username}`);
      console.log(`Current Workspace: ${userInfo.team_name}`);

    } catch (error) {
      console.error('Authentication failed. Your API key may be invalid or expired.');
      console.log('Please set a new API key with "phala auth login"');

      if (debug) {
        logger.debug(`Error details: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to check authentication status: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export const statusCommand = new Command()
  .name('status')
  .description('Check Phala Cloud status and authentication')
  .option('-j, --json', 'Output in JSON format')
  .option('-d, --debug', 'Enable debug output')
  .action(checkStatus);
