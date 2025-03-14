import { Command } from 'commander';
import { stopCvm, selectCvm, checkCvmExists } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';

export const stopCommand = new Command()
  .name('stop')
  .description('Stop a running CVM')
  .argument('[app-id]', 'App ID of the CVM (if not provided, a selection prompt will appear)')
  .action(async (appId) => {
    try {
      // If no app ID is provided, prompt user to select one
      if (!appId) {
        appId = await selectCvm();
        if (!appId) {
          return; // No CVMs found or user canceled
        }
      } else {
        appId = await checkCvmExists(appId);
      }
      
      const spinner = logger.startSpinner(`Stopping CVM with App ID app_${appId}`);
      
      await stopCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID app_${appId} stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 