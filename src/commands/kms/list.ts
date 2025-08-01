import { Command } from 'commander';
import { listKmsInstances } from '../../api/kms';
import { setCommandResult, setCommandError } from '../../utils/commander';

export const listCommand = new Command('list')
  .description('List all available KMS instances')
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Number of items per page', '20')
  .option('--onchain', 'Filter by on-chain KMS instances only')
  .action(async (options, command: Command) => {
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
      
      // Store the result in the command object
      setCommandResult(command, result);
      // Output the result for the user
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      setCommandError(command, error as Error);
      throw error; // Let the error propagate to be handled by the global error handler
    }
  });
