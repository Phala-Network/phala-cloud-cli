import { Command } from 'commander';
import { getCvmsByUserId } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { CLOUD_URL } from '@/src/utils/constants';

export const listCommand = new Command()
  .name('list')
  .description('List all CVMs')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const spinner = logger.startSpinner('Fetching CVMs');
      
      const cvms = await getCvmsByUserId();
      
      spinner.stop(true);
      
      if (!cvms || cvms.length === 0) {
        logger.info('No CVMs found');
        return;
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvms, null, 2));
        return;
      }
      
      cvms.forEach((cvm) => {
        logger.keyValueTable({
          'App ID': cvm.hosted.app_id,
          'Name': cvm.name,
          'Status': cvm.status,
          'Node Info URL': cvm.hosted.app_url,
          'App URL': `${CLOUD_URL}/dashboard/cvms/app_${cvm.hosted.app_id}`
        });
      });
      logger.success(`Found ${cvms.length} CVMs:`);
    } catch (error) {
      logger.error(`Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 