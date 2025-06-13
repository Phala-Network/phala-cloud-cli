import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey, getKmsPubkeyDirectly } from '@/src/api/kms';
import { CLOUD_URL } from '@/src/utils/constants';

import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { promptForFile } from '@/src/utils/prompts';
import { createCvmOnChainKms } from '@/src/api/cvms';


export const provisionCommand = new Command()
  .name('provision')
  .description('Provision a new CVM with on-chain KMS integration. On-chain KMS information is provided by `kms deploy` response or an existing AppAuth contract.')
  .option('--app-id <appId>', 'App ID for the CVM (with 0x prefix for on-chain KMS).')
  .option('--compose-hash <composeHash>', 'Compose hash for the CVM (SHA-256 hex string).')
  .option('--app-auth-contract-address <string>', 'AppAuth contract address for on-chain KMS')
  .option('--kms-id <string>', 'KMS ID for API-based public key retrieval.')
  .option('--kms-node-url <string>', 'KMS node URL for direct public key retrieval.')
  .option('--deployer-address <deployerAddress>', 'Deployer address for the CVM.')
  .option('-e, --env-file <envFile>', 'Path to environment file.')
  .option('--skip-env', 'Skip environment variable prompt.', false)
  .option('--debug', 'Enable debug mode', false)
  .action(async (options) => {
    try {
      // Prompt for required options if not provided
      if (!options.appId) {
        const { appId } = await inquirer.prompt([{ type: 'input', name: 'appId', message: 'Enter the App ID for the CVM:' }]);
        options.appId = appId;
      }

      if (!options.composeHash) {
        const { composeHash } = await inquirer.prompt([{ type: 'input', name: 'composeHash', message: 'Enter the compose hash for the CVM:' }]);
        options.composeHash = composeHash;
      }

      // Process environment variables
      let envs: EnvVar[] = [];
      if (options.envFile) {
        try {
          envs = parseEnv([], options.envFile);
        } catch (error) {
          logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else if (!options.skipEnv) {
        const { useEnvFile } = await inquirer.prompt([{
          type: 'confirm',
          name: 'useEnvFile',
          message: 'Do you want to provide an environment file?',
          default: false
        }]);
        if (useEnvFile) {
          const envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
          envs = parseEnv([], envFilePath);
        }
      }

      let pubkey = '';
      if (options.appAuthContractAddress) {
        const spinner = logger.startSpinner('Fetching public key from KMS...');
        let kmsResponse;
        if (options.kmsId) {
          // Use API-based method
          kmsResponse = await getKmsPubkey(options.kmsId, options.appAuthContractAddress);
        } else {
          // Use direct curl method
          if (!options.kmsNodeUrl) {
            const { kmsNodeUrl } = await inquirer.prompt([{
              type: 'input',
              name: 'kmsNodeUrl',
              message: 'Enter the KMS node URL for direct key retrieval:',
              default: 'https://kms-node-1.phala.network',
            }]);
            options.kmsNodeUrl = kmsNodeUrl;
          }
          kmsResponse = await getKmsPubkeyDirectly(options.kmsNodeUrl, options.appAuthContractAddress);
        }
        pubkey = kmsResponse.public_key;
        spinner.stop(true);
      } else if (envs.length > 0) {
        logger.error('Cannot encrypt environment variables. Please provide --app-auth-contract-address to use on-chain KMS.');
        process.exit(1);
      }

      let encrypted_env = '';
      if (envs.length > 0 && pubkey) {
        const encryptSpinner = logger.startSpinner('Encrypting environment variables');
        encrypted_env = await encryptEnvVars(envs, pubkey);
        encryptSpinner.stop(true);
      }

      const vmConfig = {
        app_id: options.appId,
        compose_hash: options.composeHash,
        contract_address: options.appAuthContractAddress,
        deployer_address: options.deployerAddress,
        encrypted_env: encrypted_env,
        kms_id: options.kmsId,
      };

      const createSpinner = logger.startSpinner('Creating CVM');
      logger.info(JSON.stringify(vmConfig));
      const response = await createCvmOnChainKms(vmConfig);
      createSpinner.stop(true);

      if (!response) {
        logger.error('Failed to create CVM');
        process.exit(1);
      }

      logger.success('CVM created successfully');
      logger.break();
      const tableData = {
        'CVM ID': response.id,
        'Name': response.name,
        'Status': response.status,
        'App ID': `app_${response.app_id}`,
        'Endpoint': `${CLOUD_URL}/cvm/instance/${response.id}`,
      };
      logger.keyValueTable(tableData);

    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
