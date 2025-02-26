import { Command } from 'commander';
import { stopCvm } from '../../api/cvms';
import { logger } from '../../utils/logger';

export const stopCommand = new Command()
  .name('stop')
  .description('Stop a running CVM')
  .argument('<app-id>', 'App ID of the CVM')
  .action(async (appId) => {
    try {
      const spinner = logger.startSpinner(`Stopping CVM with App ID ${appId}`);
      
      await stopCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 