import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { upgradeCvm } from './upgrade-cvm';
import { setCommandResult, setCommandError } from '../../utils/commander';

export const upgradeCommand = new Command()
  .name('upgrade')
  .description('Upgrade a CVM to a new version')
  .argument('[app-id]', 'CVM app ID to upgrade')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--private-key <privateKey>', 'Private key for signing transactions')
  .option('--debug', 'Enable debug mode', false)
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .action(async (appId, options, command: Command) => {
    try {
      const result = await upgradeCvm(appId, options);
      
      // Store the successful result in the command object
      setCommandResult(command, result);
      
      // Output the result
      if (options.json !== false) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.message) {
        logger.success(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = options.debug && error instanceof Error ? error.stack : undefined;
      
      // Store the error in the command object
      setCommandError(command, new Error(errorMessage));
      
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: errorStack
        }, null, 2));
      } else {
        logger.error(`Failed to upgrade CVM: ${errorMessage}`);
        if (options.debug && errorStack) {
          logger.debug(errorStack);
        }
      }
      
      // Re-throw the error to be handled by the global error handler
      throw error;
    }
  });
