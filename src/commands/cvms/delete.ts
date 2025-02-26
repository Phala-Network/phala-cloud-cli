import { Command } from 'commander';
import { deleteCvm } from '../../api/cvms';
import { logger } from '../../utils/logger';
import inquirer from 'inquirer';

export const deleteCommand = new Command()
  .name('delete')
  .description('Delete a CVM')
  .argument('<app-id>', 'App ID of the CVM to delete')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (appId, options) => {
    try {
      // Confirm deletion unless force option is used
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete CVM with App ID ${appId}? This action cannot be undone.`,
            default: false,
          },
        ]);
        
        if (!confirm) {
          logger.info('Deletion cancelled');
          return;
        }
      }
      
      // Delete the CVM
      const spinner = logger.startSpinner(`Deleting CVM ${appId}`);
      const success = await deleteCvm(appId);
      spinner.stop(true);
      
      if (!success) {
        logger.error(`Failed to delete CVM ${appId}`);
        process.exit(1);
      }
      
      logger.success(`CVM ${appId} deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 