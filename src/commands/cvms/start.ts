import { Command } from 'commander';
import { startCvm, selectCvm, checkCvmExists } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';

export const startCommand = new Command()
  .name('start')
  .description('Start a stopped CVM')
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
      
      const spinner = logger.startSpinner(`Starting CVM with App ID ${appId}`);
      
      await startCvm(appId);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 