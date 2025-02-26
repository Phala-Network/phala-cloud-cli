import { Command } from 'commander';
import { getApiKey } from '../../utils/credentials';
import { getUserInfo } from '../../api/auth';
import { logger } from '../../utils/logger';

export const statusCommand = new Command()
  .name('status')
  .description('Check authentication status')
  .action(async () => {
    try {
      const apiKey = await getApiKey();
      
      if (!apiKey) {
        logger.warn('Not authenticated. Please set an API key with "teecloud auth login"');
        return;
      }
      
      const spinner = logger.startSpinner('Checking authentication status');
      
      try {
        const userInfo = await getUserInfo();
        spinner.stop(true);
        logger.success(`Authenticated as ${userInfo.username} (ID: ${userInfo.id})`);
      } catch (error) {
        spinner.stop(false);
        logger.error('Authentication failed. Your API key may be invalid or expired.');
        logger.info('Please set a new API key with "teecloud auth login"');
      }
    } catch (error) {
      logger.error(`Failed to check authentication status: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 