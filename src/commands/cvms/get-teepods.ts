import { Command } from 'commander';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import { KmsListItem, TEEPod } from '@/src/api/types';

export const getTeepodsCommand = new Command()
  .name('get-teepods')
  .description('Get all available TEEPods.')
  .action(async () => {
    try {
      const { nodes: teepods, kms_list: kmsList } = await getTeepods();

      if (teepods.length === 0) {
        logger.info('No available TEEPods found.');
        return;
      }

      logger.info('Available TEEPods:');
      teepods.forEach((teepod: TEEPod) => {
        logger.info('----------------------------------------');
        logger.info(`  ID:          ${teepod.teepod_id}`);
        logger.info(`  Name:        ${teepod.name}`);
        logger.info(`  FMSPC:       ${teepod.fmspc || 'N/A'}`);
        logger.info(`  Device ID:   ${teepod.device_id || 'N/A'}`);
        logger.info('  Images:');
        if (teepod.images && teepod.images.length > 0) {
          teepod.images.forEach(img => {
            logger.info(`    - ${img.name}`);
            logger.info(`      Hash: ${img.os_image_hash || 'N/A'}`);
          });
        } else {
          logger.info('    N/A');
        }
      });

      if (kmsList && kmsList.length > 0) {
        logger.info('\nAvailable KMS Instances:');
        kmsList.forEach((kms: KmsListItem) => {
          logger.info('----------------------------------------');
          logger.info(`  ID:                 ${kms.id}`);
          logger.info(`  URL:                ${kms.url}`);
          logger.info(`  Version:            ${kms.version}`);
          logger.info(`  Chain ID:           ${kms.chain_id}`);
          logger.info(`  Contract Address:   ${kms.kms_contract_address}`);
          logger.info(`  Gateway App ID:     ${kms.gateway_app_id}`);
        });
      }
    } catch (error) {
      logger.error(`Failed to get available TEEPods: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
