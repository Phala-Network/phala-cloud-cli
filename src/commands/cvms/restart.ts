import { Command } from 'commander';
import { restartCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';

export const restartCommand = new Command()
  .name('restart')
  .description('Restart a CVM')
  .argument('[app-id]', 'App ID of the CVM (if not provided, a selection prompt will appear)')
  .action(async (appId) => {
    try {
      // If no app ID is provided, prompt user to select one
      if (!appId) {
        appId = await selectCvm();
        if (!appId) {
          return; // No CVMs found or user canceled
        }
      }
      
      const spinner = logger.startSpinner(`Restarting CVM with App ID ${appId}`);
      
      await restartCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} restarted successfully`);
    } catch (error) {
      logger.error(`Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 