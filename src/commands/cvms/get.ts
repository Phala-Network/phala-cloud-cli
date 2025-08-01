import { Command } from 'commander';
import { getCvmByAppId } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { CLOUD_URL } from '@/src/utils/constants';
import chalk from 'chalk';
import { resolveCvmAppId } from '@/src/utils/cvms';

export const getCommand = new Command()
  .name('get')
  .description('Get details of a CVM')
  .argument('[app-id]', 'App ID of the CVM (optional)')
  .option('-j, --json', 'Output in JSON format')
  .action(async function(this: Command, appId, options) {
    // Initialize telemetry data
    const telemetryData: any = {
      timestamp: new Date().toISOString(),
      jsonOutput: options.json || false,
      appId: '',
      success: false
    };

    try {
      const resolvedAppId = await resolveCvmAppId(appId);
      telemetryData.appId = `${resolvedAppId}`;
      
      const spinner = logger.startSpinner(`Fetching CVM with App ID app_${resolvedAppId}`);
      
      const cvm = await getCvmByAppId(resolvedAppId);
      
      spinner.stop(true);
      logger.break();
      
      if (!cvm) {
        const errorMessage = `CVM with App ID app_${resolvedAppId} not found`;
        setCommandError(this, new Error(errorMessage));
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvm, null, 2));
        // Update telemetry for successful JSON output
        setCommandResult(this, {
          ...telemetryData,
          success: true,
          message: 'CVM details retrieved successfully in JSON format'
        });
        return;
      }
      
      // Display additional details if available
      logger.keyValueTable({
        'Name': cvm.name,
        'App ID': `app_${cvm.app_id}`,
        'Status': (cvm.status === 'running') ? chalk.green(cvm.status) : (cvm.status === 'stopped') ? chalk.red(cvm.status) : chalk.yellow(cvm.status),
        'vCPU': cvm.vcpu,
        'Memory': `${cvm.memory} MB`,
        'Disk Size': `${cvm.disk_size} GB`,
        'Dstack Image': cvm.base_image,
        'App URL': `${CLOUD_URL}/dashboard/cvms/app_${cvm.app_id}`
      });

      // Update telemetry for successful operation
      setCommandResult(this, {
        ...telemetryData,
        success: true,
        message: 'CVM details retrieved successfully',
        cvmStatus: cvm.status,
        vcpu: cvm.vcpu,
        memory: cvm.memory,
        diskSize: cvm.disk_size
      });
    } catch (error) {
      const errorMessage = `Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`;
      setCommandError(this, new Error(errorMessage));
      logger.error(errorMessage);
      // Don't call process.exit() to ensure telemetry is sent
      throw error;
    }
  }); 