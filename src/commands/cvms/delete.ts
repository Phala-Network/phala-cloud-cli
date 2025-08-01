import { Command } from 'commander';
import { deleteCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import inquirer from 'inquirer';
import { resolveCvmAppId } from '@/src/utils/cvms';

export const deleteCommand = new Command()
  .name('delete')
  .description('Delete a CVM')
  .argument('[app-id]', 'App ID of the CVM to delete (if not provided, a selection prompt will appear)')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async function(this: Command, appId, options) {
    // Initialize telemetry data
    const telemetryData: any = {
      timestamp: new Date().toISOString(),
      forceDelete: options.force || false,
      confirmed: false,
      appId: '',
      success: false
    };

    try {
      const resolvedAppId = await resolveCvmAppId(appId);
      telemetryData.appId = `${resolvedAppId}`;
      
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
        
        telemetryData.confirmed = confirm;
        
        if (!confirm) {
          logger.info('Deletion cancelled');
          setCommandResult(this, {
            ...telemetryData,
            success: false,
            message: 'Deletion cancelled by user'
          });
          return;
        }
      } else {
        telemetryData.confirmed = true;
      }
      
      // Delete the CVM
      const spinner = logger.startSpinner(`Deleting CVM app_${resolvedAppId}`);
      const success = await deleteCvm(resolvedAppId);
      spinner.stop(true);
      
      if (!success) {
        const errorMessage = `Failed to delete CVM app_${resolvedAppId}`;
        setCommandError(this, new Error(errorMessage));
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Update telemetry data for successful deletion
      telemetryData.success = true;
      setCommandResult(this, {
        ...telemetryData,
        message: 'CVM deleted successfully'
      });
      
      logger.success(`CVM app_${resolvedAppId} deleted successfully`);
    } catch (error) {
      const errorMessage = `Failed to delete CVM: ${error instanceof Error ? error.message : String(error)}`;
      setCommandError(this, new Error(errorMessage));
      logger.error(errorMessage);
      // Don't call process.exit() to ensure telemetry is sent
      throw error;
    }
  }); 