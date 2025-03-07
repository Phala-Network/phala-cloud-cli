import { Command } from 'commander';
import { getCvmByAppId, getCvms, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { CLOUD_URL } from '@/src/utils/constants';

export const getCommand = new Command()
  .name('get')
  .description('Get details of a CVM')
  .option('-i, --id <app-id>', 'App ID of the CVM (optional)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      let appId = options.id;
      
      // If no app ID is provided, fetch all CVMs and let the user select one
      if (!appId) {
        appId = await selectCvm();
        if (!appId) {
          return; // No CVMs found or user canceled
        }
      }
      
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
      
      // Display additional details if available
      logger.keyValueTable({
        'Name': cvm.name,
        'Status': cvm.status,
        'vCPU': cvm.vcpu,
        'Memory': `${cvm.memory} MB`,
        'Disk Size': `${cvm.disk_size} GB`,
        'Dstack Image': cvm.base_image,
        'TEEPod ID': cvm.teepod_id,
        'App URL': `${CLOUD_URL}/dashboard/cvms/app_${cvm.app_id}`
      });
    } catch (error) {
      logger.error(`Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 