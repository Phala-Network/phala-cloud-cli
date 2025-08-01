import { Command } from 'commander';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { restartCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { resolveCvmAppId } from '@/src/utils/cvms';
import { CLOUD_URL } from '@/src/utils/constants';

export const restartCommand = new Command()
  .name('restart')
  .description('Restart a CVM')
  .argument('[app-id]', 'App ID of the CVM (if not provided, a selection prompt will appear)')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .option('--debug', 'Enable debug logging', false)
  .action(async function(this: Command, appId, options) {
    try {
      const resolvedAppId = await resolveCvmAppId(appId);

      const spinner = logger.startSpinner(
        `Restarting CVM with App ID app_${resolvedAppId}`,
      );

      const response = await restartCvm(resolvedAppId);

      spinner.stop(true);
      
      const result = {
        cvmId: response.id,
        name: response.name,
        status: response.status,
        appId: `app_${response.app_id}`,
        appUrl: response.app_url || `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
        dashboardUrl: `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
        timestamp: new Date().toISOString()
      };
      
      // Set command result for telemetry
      setCommandResult(this, {
        success: true,
        ...result
      });
      
      if (options.json !== false) {
        console.log(JSON.stringify({
          success: true,
          cvm_id: result.cvmId,
          name: result.name,
          status: result.status,
          app_id: result.appId,
          app_url: result.appUrl,
          dashboard_url: result.dashboardUrl
        }, null, 2));
      } else {
        logger.break();
        logger.keyValueTable({
          'CVM ID': result.cvmId,
          'Name': result.name,
          'Status': result.status,
          'App ID': result.appId,
          'App URL': result.appUrl
        }, {
          borderStyle: 'rounded'
        });
        
        logger.break();
        logger.success(
          `Your CVM is being restarted. You can check the dashboard for more details:\n${result.dashboardUrl}`);
      }
      
      return;
    } catch (error) {
      const errorMessage = `Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`;
      const errorStack = options.debug && error instanceof Error ? error.stack : undefined;
      
      // Set command error for telemetry
      setCommandError(this, new Error(errorMessage));
      
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: errorStack
        }, null, 2));
      } else {
        logger.error(errorMessage);
      }
      
      // Don't call process.exit() as it prevents telemetry from being sent
      throw error;
    }
  }); 