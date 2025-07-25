import { Command } from 'commander';
import { getKmsInfo } from '../../api/kms';
import { logger } from '../../utils/logger';

export const infoCommand = new Command('info')
  .description('Get detailed information about a specific KMS instance by its slug or ID')
  .argument('<identifier>', 'KMS instance slug or ID (e.g., testnet-kms-2 or kms_mNZymZRb)')
  .action(async (identifier: string) => {
    try {
      const kmsInfo = await getKmsInfo(identifier);
      console.log(JSON.stringify(kmsInfo, null, 2));
    } catch (error) {
      logger.error(`Failed to get KMS info: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
