import { Command } from 'commander';
import { checkCvmExists, deleteCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import inquirer from 'inquirer';
import { resolveCvmAppId } from '@/src/utils/cvms';

export const deleteCommand = new Command()
  .name('delete')
  .description('Delete a CVM')
  .argument('[app-id]', 'App ID of the CVM to delete (if not provided, a selection prompt will appear)')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (appId, options) => {
    try {
      const resolvedAppId = await resolveCvmAppId(appId);
      
      // Confirm deletion unless force option is used
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete CVM with App ID app_${resolvedAppId}? This action cannot be undone.`,
            default: false,
          },
        ]);
        
        if (!confirm) {
          logger.info('Deletion cancelled');
          return;
        }
      }
      
      // Delete the CVM
      const spinner = logger.startSpinner(`Deleting CVM app_${resolvedAppId}`);
      const success = await deleteCvm(resolvedAppId);
      spinner.stop(true);
      
      if (!success) {
        logger.error(`Failed to delete CVM app_${resolvedAppId}`);
        process.exit(1);
      }

		logger.success(`CVM app_${resolvedAppId} deleted successfully`);
	} catch (error) {
		logger.error(
			`Failed to delete CVM: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
  }); 