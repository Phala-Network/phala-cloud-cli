import { Command } from 'commander';
import { listKmsInstances } from '../../api/kms';
import { logger } from '../../utils/logger';

export const listCommand = new Command('list')
  .description('List all available KMS instances')
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Number of items per page', '20')
  .option('--onchain', 'Filter by on-chain KMS instances only')
  .action(async (options) => {
    try {
      const listOptions = {
        page: options.page ? parseInt(options.page, 10) : undefined,
        pageSize: options.pageSize ? parseInt(options.pageSize, 10) : undefined,
        isOnchain: options.onchain
      };

      const kmsInstances = await listKmsInstances(listOptions);
      
      // Format the response to include pagination info if needed
      const result = {
        items: kmsInstances,
        total: kmsInstances.length,
        page: options.page ? parseInt(options.page, 10) : 1,
        page_size: options.pageSize ? parseInt(options.pageSize, 10) : 20,
      };
      
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      logger.error(`Failed to list KMS instances: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
