import { Command } from 'commander';
import { restartCvm } from '../../api/cvms';
import { logger } from '../../utils/logger';

export const restartCommand = new Command()
  .name('restart')
  .description('Restart a CVM')
  .argument('<app-id>', 'App ID of the CVM')
  .action(async (appId) => {
    try {
      const spinner = logger.startSpinner(`Restarting CVM with App ID ${appId}`);
      
      await restartCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} restarted successfully`);
    } catch (error) {
      logger.error(`Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 