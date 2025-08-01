import { Command } from 'commander';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import { KmsListItem, TEEPod } from '@/src/api/types';
import { setCommandResult, setCommandError } from '@/src/utils/commander';

export async function listNodes(command?: Command): Promise<void> {
  try {
    const { nodes: teepods, kms_list: kmsList } = await getTeepods();
    const result: {
      success: boolean;
      nodeCount: number;
      kmsCount: number;
      nodes?: TEEPod[];
      kmsInstances?: KmsListItem[];
    } = {
      success: true,
      nodeCount: teepods?.length || 0,
      kmsCount: kmsList?.length || 0,
      nodes: [],
      kmsInstances: []
    };

    if (teepods.length === 0) {
      const message = 'No available nodes found.';
      logger.info(message);
      if (command) {
        setCommandResult(command, { ...result, message });
      }
      return;
    }

    // Store nodes data in result
    result.nodes = teepods;

    // Log nodes information
    logger.info('Available Nodes:');
    teepods.forEach((teepod: TEEPod) => {
      logger.info('----------------------------------------');
      logger.info(`  ID:          ${teepod.teepod_id}`);
      logger.info(`  Name:        ${teepod.name}`);
      if (teepod.region_identifier) {
        logger.info(`  Region:      ${teepod.region_identifier}`);
      }
      if (teepod.fmspc) {
        logger.info(`  FMSPC:       ${teepod.fmspc}`);
      }
      if (teepod.device_id) {
        logger.info(`  Device ID:   ${teepod.device_id}`);
      }
      logger.info(`  Support Contract Owned CVM: ${teepod.support_onchain_kms}`);
      
      logger.info('  Images:');
      if (teepod.images && teepod.images.length > 0) {
        teepod.images.forEach(img => {
          logger.info(`    - ${img.name}`);
          if (img.os_image_hash) {
            logger.info(`      Hash: ${img.os_image_hash}`);
          }
        });
      } else {
        logger.info('    N/A');
      }
    });

    if (kmsList && kmsList.length > 0) {
      // Store KMS instances data in result
      result.kmsInstances = kmsList;

      logger.info('\nAvailable KMS Instances:');
      kmsList.forEach((kms: KmsListItem) => {
        logger.info('----------------------------------------');
        logger.info(`  Name:               ${kms.slug}`);
        logger.info(`  URL:                ${kms.url}`);
        logger.info(`  Version:            ${kms.version}`);
        if (kms.chain_id) {
          logger.info(`  Chain ID:           ${kms.chain_id}`);
          logger.info(`  Contract Address:   ${kms.kms_contract_address}`);
          logger.info(`  Gateway App ID:     ${kms.gateway_app_id}`);
        }
      });
    }
    
    if (command) {
      setCommandResult(command, result);
    }
    
    return;
  } catch (error) {
    const errorMessage = `Failed to list available nodes: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    
    if (command) {
      setCommandError(command, new Error(errorMessage));
    }
    
    throw error;
  }
}
