import { Command } from 'commander';
import { getCvmByAppId } from '../../api/cvms';
import { logger } from '../../utils/logger';

export const getCommand = new Command()
  .name('get')
  .description('Get details of a CVM')
  .argument('<app-id>', 'App ID of the CVM')
  .option('-j, --json', 'Output in JSON format')
  .action(async (appId, options) => {
    try {
      const spinner = logger.startSpinner(`Fetching CVM with App ID ${appId}`);
      
      const cvm = await getCvmByAppId(appId);
      
      spinner.stop(true);
      
      if (!cvm) {
        logger.error(`CVM with App ID ${appId} not found`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvm, null, 2));
        return;
      }
      
      logger.info(`CVM Details for App ID ${appId}:`);
      logger.info(`Name: ${cvm.name}`);
      logger.info(`Status: ${cvm.status}`);
      logger.info(`App URL: ${cvm.app_url}`);
      
      // Display additional details if available
      if (cvm.vcpu) logger.info(`vCPU: ${cvm.vcpu}`);
      if (cvm.memory) logger.info(`Memory: ${cvm.memory} MB`);
      if (cvm.disk_size) logger.info(`Disk Size: ${cvm.disk_size} GB`);
    } catch (error) {
      logger.error(`Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 