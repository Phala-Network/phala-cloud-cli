import { Command } from 'commander';
import { checkCvmExists, getCvmByAppId, getCvms, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { CLOUD_URL } from '@/src/utils/constants';
import chalk from 'chalk';

export const getCommand = new Command()
  .name('get')
  .description('Get details of a CVM')
  .argument('[app-id]', 'App ID of the CVM (optional)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (appId, options) => {
    try {
      // If no app ID is provided, fetch all CVMs and let the user select one
      if (!appId) {
        appId = await selectCvm();
        if (!appId) {
          logger.info('No CVMs found or selection cancelled');
          return;
        }
      } else {
        appId = await checkCvmExists(appId);
      }
      
      const spinner = logger.startSpinner(`Fetching CVM with App ID app_${appId}`);
      
      const cvm = await getCvmByAppId(appId);
      
      spinner.stop(true);
      
      if (!cvm) {
        logger.error(`CVM with App ID app_${appId} not found`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvm, null, 2));
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
    } catch (error) {
      logger.error(`Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 