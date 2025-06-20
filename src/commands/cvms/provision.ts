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


async function gatherProvisionInputs(options: any): Promise<any> {
  const questions = [];
  if (!options.appId) {
    questions.push({ type: 'input', name: 'appId', message: 'Enter the App ID for the CVM:' });
  }
  if (!options.composeHash) {
    questions.push({ type: 'input', name: 'composeHash', message: 'Enter the compose hash for the CVM:' });
  }
  if (!options.kmsId) {
    questions.push({ type: 'input', name: 'kmsId', message: 'Enter the KMS ID for the CVM:' });
  }
  if (!options.appAuthContractAddress) {
    questions.push({ type: 'input', name: 'appAuthContractAddress', message: 'Enter the AppAuth contract address:' });
  }

  if (questions.length === 0) {
    return options;
  }

  const answers = await inquirer.prompt(questions);
  return { ...options, ...answers };
}

async function getAndEncryptEnvs(options: any): Promise<string> {
  let envs: EnvVar[] = [];
  if (options.envFile) {
    envs = parseEnv([], options.envFile);
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

  if (envs.length === 0) {
    return '';
  }

  if (!options.appAuthContractAddress || !options.kmsId || !options.appId) {
    throw new Error('To encrypt environment variables, --app-auth-contract-address, --kms-id, and --app-id are required.');
  }

  const spinner = logger.startSpinner('Fetching public key from KMS...');
  const kmsResponse = await getKmsPubkey(options.kmsId, options.appId);
  const pubkey = kmsResponse.public_key;
  spinner.stop(true);

  if (!pubkey) {
    throw new Error('Failed to retrieve public key from KMS.');
  }

  const encryptSpinner = logger.startSpinner('Encrypting environment variables');
  const encrypted_env = await encryptEnvVars(envs, pubkey);
  encryptSpinner.stop(true);

  return encrypted_env;
}

function buildVmConfig(options: any, encryptedEnv: string): any {
  return {
    app_id: options.appId,
    compose_hash: options.composeHash,
    contract_address: options.appAuthContractAddress,
    deployer_address: options.deployerAddress,
    encrypted_env: encryptedEnv,
    kms_id: options.kmsId,
  };
}

function displayProvisionResult(response: any): void {
  logger.success('CVM provisioned successfully');
  logger.break();
  const tableData = {
    'CVM ID': response.vm_uuid.replace(/-/g, ''),
    'Name': response.name,
    'Status': response.status,
    'App ID': response.app_id,
    'Endpoint': `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
  };
  logger.keyValueTable(tableData);
}

export const provisionCommand = new Command()
  .name('provision')
  .description('Provision a new CVM with on-chain KMS integration.')
  .option('--app-id <appId>', 'App ID for the CVM (with 0x prefix for on-chain KMS).')
  .option('--compose-hash <composeHash>', 'Compose hash for the CVM (SHA-256 hex string).')
  .option('--app-auth-contract-address <appAuthContractAddress>', 'AppAuth contract address for on-chain KMS')
  .option('--kms-id <kmsId>', 'KMS ID for API-based public key retrieval.')
  .option('--deployer-address <deployerAddress>', 'Deployer address for the CVM.')
  .option('-e, --env-file <envFile>', 'Path to environment file.')
  .option('--skip-env', 'Skip environment variable prompt.', false)
  .option('--debug', 'Enable debug mode', false)
  .action(async (options) => {
    try {
      const fullOptions = await gatherProvisionInputs(options);
      const encryptedEnv = await getAndEncryptEnvs(fullOptions);
      const vmConfig = buildVmConfig(fullOptions, encryptedEnv);

      const createSpinner = logger.startSpinner('Provisioning CVM...');
      if (options.debug) {
        logger.info(`Provisioning with config: ${JSON.stringify(vmConfig, null, 2)}`);
      }
      const response = await createCvmOnChainKms(vmConfig);
      createSpinner.stop(true);

      if (!response) {
        throw new Error('Failed to provision CVM. The API returned an empty response.');
      }

      displayProvisionResult(response);

    } catch (error) {
      // Spinners are stopped within their respective functions on success or failure.
      // We just need to log the final error here.
      logger.error(`Failed to provision CVM: ${error instanceof Error ? error.message : String(error)}`);
      if (options.debug && error.stack) {
        logger.error(error.stack);
      }
      process.exit(1);
    }
  });
