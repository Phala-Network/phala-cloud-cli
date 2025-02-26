import { Command } from 'commander';
import { startCvm } from '../../api/cvms';
import { logger } from '../../utils/logger';

export const startCommand = new Command()
  .name('start')
  .description('Start a stopped CVM')
  .argument('<app-id>', 'App ID of the CVM')
  .action(async (appId) => {
    try {
      const spinner = logger.startSpinner(`Starting CVM with App ID ${appId}`);
      
      await startCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 