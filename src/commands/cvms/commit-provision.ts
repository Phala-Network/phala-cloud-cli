import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey, getKmsPubkeyDirectly } from '@/src/api/kms';
import { CLOUD_URL } from '@/src/utils/constants';

import { parseEnv } from '@/src/utils/secrets';
import { promptForFile } from '@/src/utils/prompts';
import { createCvmOnChainKms } from '@/src/api/cvms';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { getTeepods } from '@/src/api/teepods';
import { createPublicClient, http } from 'viem';
import { ethers } from 'ethers';
import { getChainConfig, getNetworkConfig } from '@/src/utils/blockchain';

async function getAndEncryptEnvs(options: any): Promise<string> {
  let envs: EnvVar[] = [];
  if (!options.skipEnv) {
    // If envFile is not provided, try to find one automatically
    let envFilePath = options.envFile;

    if (!envFilePath) {
      // Check for environment files in order of priority
      const envFiles = ['.env.production', '.env.prod', '.env'];
      for (const file of envFiles) {
        if (fs.existsSync(file)) {
          envFilePath = file;
          logger.info(`Using environment file: ${envFilePath}`);
          break;
        }
      }

      // If no env file found, ask user if they want to provide one
      if (!envFilePath) {
        if (!options.interactive) {
          logger.error('Environment file is required. Use --env-file to select it');
          process.exit(1);
        } else {
          envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
        }
      }
    }
    if (envFilePath) {
      try {
        // Read and parse environment variables
        envs = parseEnv([], envFilePath);
      } catch (error) {
        logger.error(`Error reading environment file ${envFilePath}:`, error);
      }
    }
  }

  if (envs.length === 0) {
    return '';
  }

  if (!options.appId) {
    if (!options.interactive) {
      throw new Error('To encrypt environment variables, --app-id is required.');
    } else {
      options.appId = await inquirer.prompt([
        {
          type: 'input',
          name: 'appId',
          message: 'Enter the App ID for the CVM:',
        }
      ]);
    }
  }

  const spinner = logger.startSpinner('Fetching public key from KMS...');
  let kmsResponse;
  if (!options.kmsId) {
    kmsResponse = await getKmsPubkeyDirectly(options.appId);
  } else {
    kmsResponse = await getKmsPubkey(options.kmsId, options.appId);
  }
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

async function buildVmConfig(options: any, encryptedEnv: string): Promise<any> {
  logger.info(`Using custom App ID: ${options.customAppId}, fetching AppAuth details from KMS...`);
  let kmsInfo;
  let kmsContractAddress;
  let appAuthContractAddress;
  // Get KMS list from the teepods response (it's at the root level, not in individual teepods)
  const teepodsSpinner = logger.startSpinner('Fetching available Nodes');
  const teepods = await getTeepods();
  teepodsSpinner.stop(true);
  if (teepods.nodes.length === 0) {
    throw new Error('No Nodes available.');
  }
  const allKmsInfos = teepods.kms_list || [];
  kmsInfo = allKmsInfos.find(kms => kms.id === options.kmsId);

  if (!kmsInfo) {
    throw new Error(`No KMS found with ID: ${options.kmsId} in the available Nodes`);
  }

  kmsContractAddress = kmsInfo.kms_contract_address;
  logger.info(`Using KMS contract address: ${kmsContractAddress} from KMS ID: ${options.kmsId}`);

  // Get the first available KMS to determine the chain
  // TODO: when multiple KMS are available, how to choose one?
  const kms = teepods.kms_list?.[0];
  if (!kms) {
    throw new Error('No KMS available');
  }

  // Get the chain config
  const chain = getChainConfig(kms.chain_id);
  const rpcUrl = options.rpcUrl || chain.rpcUrls.default.http[0];
  
  // Initialize public client with the appropriate chain and RPC URL
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });

  // KMS Auth ABI for reading app registration details
  const kmsAuthAbi = [
    {
      inputs: [{ name: 'app', type: 'address' }],
      name: 'apps',
      outputs: [
        { name: 'isRegistered', type: 'bool' },
        { name: 'controller', type: 'address' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  try {
    // Ensure the KMS contract address is valid
    if (!ethers.isAddress(kmsContractAddress)) {
      throw new Error(`Invalid KMS contract address: ${kmsContractAddress}`);
    }

    if (!ethers.isAddress(options.appId)) {
      throw new Error(`Invalid custom App ID: ${options.appId}`);
    }

    // Ensure customAppId has 0x prefix
    const customAppId = options.appId.startsWith('0x')
      ? options.appId
      : `0x${options.appId}`;

    // Query the KMS contract for app registration details
    const [isRegistered, controllerAddress] = await publicClient.readContract({
      address: kmsContractAddress as `0x${string}`,
      abi: kmsAuthAbi,
      functionName: 'apps',
      args: [customAppId as `0x${string}`]
    });

    // Validate the response
    if (!isRegistered) {
      throw new Error(`App ${options.appId} is not registered in KMS contract ${kmsContractAddress}`);
    }

    if (!controllerAddress || controllerAddress === ethers.ZeroAddress) {
      throw new Error(`Invalid controller address for app ${options.appId}`);
    }

    logger.info(`Successfully verified AppAuth contract at ${controllerAddress}`);
    appAuthContractAddress = controllerAddress;

  } catch (error) {
    throw new Error(`Failed to verify custom App ID: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    app_id: options.appId,
    compose_hash: options.composeHash,
    contract_address: appAuthContractAddress,
    deployer_address: '',
    encrypted_env: encryptedEnv,
    kms_id: options.kmsId,
  };
}

function displayProvisionResult(response: any, options: any): void {
  logger.success('CVM provisioned successfully');
  logger.break();
  if (options.json !== false) {
    // Output as JSON for script consumption
    const jsonOutput = {
      success: true,
      data: {
        cvm_id: response.vm_uuid.replace(/-/g, ''),
        name: response.name,
        status: response.status,
        app_id: response.app_id,
        endpoint: `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
      }
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    // Human-readable output
    const tableData = {
      'CVM ID': response.vm_uuid.replace(/-/g, ''),
      'Name': response.name,
      'Status': response.status,
      'App ID': response.app_id,
      'Endpoint': `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
    };
    logger.keyValueTable(tableData);
  }
}

export const commitProvisionCommand = new Command()
  .name('commit-provision')
  .description('Provision a new CVM with on-chain KMS integration.')
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--app-id <appId>', 'App ID for the CVM (with 0x prefix for on-chain KMS).')
  .option('--compose-hash <composeHash>', 'Compose hash for the CVM (SHA-256 hex string).')
  .option('--kms-id <kmsId>', 'KMS ID for API-based public key retrieval.')
  .option('--deployer-address <deployerAddress>', 'Deployer address for the CVM.')
  .option('-e, --env-file <envFile>', 'Path to environment file.')
  .option('--skip-env', 'Skip environment variable prompt.', false)
  .option('--debug', 'Enable debug mode', false)
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .action(async (options) => {
    try {
      const encryptedEnv = await getAndEncryptEnvs(options);
      const vmConfig = await buildVmConfig(options, encryptedEnv);

      const createSpinner = logger.startSpinner('Provisioning CVM...');
      if (options.debug) {
        logger.info(`Provisioning with config: ${JSON.stringify(vmConfig, null, 2)}`);
      }
      const response = await createCvmOnChainKms(vmConfig);
      createSpinner.stop(true);

      if (!response) {
        throw new Error('Failed to provision CVM. The API returned an empty response.');
      }

      displayProvisionResult(response, options);

    } catch (error) {
      // Spinners are stopped within their respective functions on success or failure.
      // We just need to log the final error here.
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: options.debug && error instanceof Error ? error.stack : undefined
        }, null, 2));
      } else {
        logger.error(`Failed to provision CVM: ${errorMessage}`);
        if (options.debug && error.stack) {
          logger.error(error.stack);
        }
      }
      process.exit(1);
    }
  });
