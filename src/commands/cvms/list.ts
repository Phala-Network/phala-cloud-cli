import { Command } from 'commander';
import { getCvms } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { CLOUD_URL } from '@/src/utils/constants';
import chalk from 'chalk';

export const listCommand = new Command()
  .name('list')
  .alias('ls')
  .description('List all CVMs')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const spinner = logger.startSpinner('Fetching CVMs');
      
      const cvms = await getCvms();
      
      spinner.stop(true);
      
      if (!cvms || cvms.length === 0) {
        logger.info('No CVMs found');
        return;
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvms, null, 2));
        return;
      }
      
      for (const cvm of cvms) {
        logger.keyValueTable({
            Name: cvm.name,
            "App ID": `app_${cvm.hosted.app_id}`,
            Status:
              cvm.status === "running"
                ? chalk.green(cvm.status)
                : cvm.status === "stopped"
                  ? chalk.red(cvm.status)
                  : chalk.yellow(cvm.status),
            "Node Info URL": cvm.hosted.app_url,
            "App URL": `${CLOUD_URL}/dashboard/cvms/app_${cvm.hosted.app_id}`,
        });
        logger.break();
      }
      logger.success(`Found ${cvms.length} CVMs`);
      logger.break();
      logger.info(`Go to ${CLOUD_URL}/dashboard/ to view your CVMs`);
    } catch (error) {
      logger.error(`Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 