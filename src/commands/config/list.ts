import { Command } from 'commander';
import { listConfigValues } from '@/src/utils/config';
import { logger } from '@/src/utils/logger';

export const listCommand = new Command()
  .name('list')
  .description('List all configuration values')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    try {
      const config = listConfigValues();
      
      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }
      
      logger.info('Configuration values:');
      for (const [key, value] of Object.entries(config)) {
        logger.info(`${key}: ${JSON.stringify(value)}`);
      }
    } catch (error) {
      logger.error(`Failed to list configuration values: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 