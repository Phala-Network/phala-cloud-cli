import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { upgradeCvm } from './upgrade-cvm.js';

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
  .action(async (appId, options) => {
    try {
      await upgradeCvm(appId, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: options.debug && error instanceof Error ? error.stack : undefined
        }, null, 2));
      } else {
        logger.error(`Failed to upgrade CVM: ${errorMessage}`);
      }
      process.exit(1);
    }
  });
