import { Command } from 'commander';
import { getCvmsByUserId } from '../../api/cvms';
import { logger } from '../../utils/logger';

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
      
      logger.info(`Found ${cvms.length} CVMs:`);
      
      cvms.forEach((cvm) => {
        logger.info(`
App ID: ${cvm.hosted.app_id}
Name: ${cvm.name}
Status: ${cvm.status}
URL: ${cvm.hosted.app_url}
-------------------`);
      });
    } catch (error) {
      logger.error(`Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 