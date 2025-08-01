import { Command } from 'commander';
import { getKmsInfo } from '../../api/kms';
import { setCommandResult, setCommandError } from '../../utils/commander';

export const infoCommand = new Command('info')
  .description('Get detailed information about a specific KMS instance by its slug or ID')
  .argument('<identifier>', 'KMS instance slug or ID (e.g., testnet-kms-2 or kms_mNZymZRb)')
  .action(async (identifier: string, command: Command) => {
    try {
      const kmsInfo = await getKmsInfo(identifier);
      // Store the result in the command object
      setCommandResult(command, kmsInfo);
      // Output the result for the user
      console.log(JSON.stringify(kmsInfo, null, 2));
    } catch (error) {
      setCommandError(command, error as Error);
      throw error; // Let the error propagate to be handled by the global error handler
    }
  });
