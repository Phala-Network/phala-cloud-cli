import { Command } from 'commander';
import { removeApiKey } from '../../utils/credentials';
import { logger } from '../../utils/logger';

export const logoutCommand = new Command()
  .name('logout')
  .description('Remove the stored API key')
  .action(async () => {
    try {
      await removeApiKey();
      logger.success('API key removed successfully');
    } catch (error) {
      logger.error(`Failed to remove API key: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 