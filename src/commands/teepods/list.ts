import { Command } from 'commander';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';

export const listCommand = new Command()
  .name('list')
  .alias('ls')
  .description('List available TEEPods')
  .action(async () => {
    try {
      const spinner = logger.startSpinner('Fetching TEEPods');
      
      const teepods = await getTeepods();
      
      spinner.stop(true);
      
      if (teepods.length === 0) {
        logger.info('No TEEPods found');
        return;
      }
      
      logger.info('Available TEEPods:');
      logger.table(teepods, ['teepod_id', 'name']);
    } catch (error) {
      logger.error(`Failed to list TEEPods: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 