import { Command } from 'commander';
import { createCvm, createCvmOnChainKms, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod, TeepodResponse } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey } from '@/src/api/kms';
import { handleAppAuthDeployment, ensureHexPrefix } from '@/src/utils/blockchain';
import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

import fs from 'fs-extra';
import path from 'node:path';
import inquirer from 'inquirer';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';

/**
 * Gathers and validates all necessary configurations for creating a CVM.
 */
async function gatherCvmConfig(options: any) {
  if (!options.name) {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for the CVM:',
        validate: (input) => {
          if (!input.trim()) return 'CVM name is required';
          if (input.trim().length > 20) return 'CVM name must be less than 20 characters';
          if (input.trim().length < 3) return 'CVM name must be at least 3 characters';
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'CVM name must contain only letters, numbers, underscores, and hyphens';
          return true;
        }
      }
    ]);
    options.name = name;
  }

  if (!options.compose) {
    const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
    const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
    options.compose = await promptForFile('Enter the path to your Docker Compose file:', composeFileName, 'file');
  }

  const composePath = path.resolve(options.compose);
  if (!fs.existsSync(composePath)) {
    throw new Error(`Docker Compose file not found: ${composePath}`);
  }
  const composeString = fs.readFileSync(composePath, 'utf8');

  // Handle environment variables
  let envs: EnvVar[] = [];
  let allowedEnvs: string[] = [];

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
        envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
      }
    }

    if (envFilePath) {
      try {
        // Read and parse environment variables
        envs = parseEnv([], envFilePath);

        // Extract just the keys for allowed_envs
        allowedEnvs = envs.map(env => env.key);

        if (allowedEnvs.length > 0) {
          logger.info(`Using environment variables from ${envFilePath}`);
          logger.debug(`Allowed environment variables: ${allowedEnvs.join(', ')}`);
        } else {
          logger.warn(`No environment variables found in ${envFilePath}`);
        }
      } catch (error) {
        logger.error(`Error reading environment file ${envFilePath}:`, error);
      }
    }
  }

  const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
  const teepods = await getTeepods();
  teepodsSpinner.stop(true);
  if (teepods.nodes.length === 0) {
    throw new Error('No TEEPods available.');
  }

  // Filter TEEpods based on on-chain KMS support
  let availableTeepods = teepods.nodes.filter(teepod =>
    options.kmsId ? teepod.support_onchain_kms : !teepod.support_onchain_kms
  );

  if (availableTeepods.length === 0) {
    const errorMessage = options.kmsId
      ? 'No TEEPods available that support on-chain KMS.'
      : 'No TEEPod available that does not support on-chain KMS.';
    throw new Error(errorMessage);
  }

  // If kms-id is provided, find the corresponding KMS info
  let kmsInfo;
  let kmsContractAddress;
  if (options.kmsId) {
    // Get KMS list from the teepods response (it's at the root level, not in individual teepods)
    const allKmsInfos = teepods.kms_list || [];
    kmsInfo = allKmsInfos.find(kms => kms.id === options.kmsId);

    if (!kmsInfo) {
      throw new Error(`No KMS found with ID: ${options.kmsId} in the available TEEPods`);
    }

    kmsContractAddress = kmsInfo.kms_contract_address;
    logger.info(`Using KMS contract address: ${kmsContractAddress} from KMS ID: ${options.kmsId}`);
  }

  let selectedTeepod: TEEPod;
  if (options.teepodId) {
    selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.teepodId));
    if (!selectedTeepod) {
      throw new Error(`Selected TEEPod with ID ${options.teepodId} is not available or does not support on-chain KMS.`);
    }
  } else {
    const { teepod } = await inquirer.prompt([{ type: 'list', name: 'teepod', message: 'Select a TEEPod to use:', choices: availableTeepods.map(t => ({ name: `${t.name} (ID: ${t.teepod_id})`, value: t })) }]);
    selectedTeepod = teepod;
  }

  const selectedImage = selectedTeepod.images?.find(image => image.name === DEFAULT_ONCHAIN_IMAGE);
  if (!selectedImage) {
    throw new Error(`Failed to find default image ${DEFAULT_ONCHAIN_IMAGE} for the selected TEEPod.`);
  }

  // allowedEnvs is already set above from the env file parsing

  const composeFile: any = {
    docker_compose_file: composeString,
    allowed_envs: allowedEnvs,
    features: ['kms', 'tproxy-net'],
    kms_enabled: true,
    manifest_version: 2,
    name: options.name,
    public_logs: true,
    public_sysinfo: true,
    tproxy_enabled: true,
  };

  if (options.preLaunchScript) {
    composeFile.pre_launch_script = options.preLaunchScript;
  }

  const vmConfig = {
    teepod_id: selectedTeepod.teepod_id,
    name: options.name,
    image: selectedImage.name,
    vcpu: Number(options.vcpu) || DEFAULT_VCPU,
    memory: Number(options.memory) || DEFAULT_MEMORY,
    disk_size: Number(options.diskSize) || DEFAULT_DISK_SIZE,
    compose_file: composeFile,
    listed: false,
  }

  return { vmConfig, envs, teepods, kmsContractAddress };
}

/**
 * Provisions the CVM and logs the result.
 */
async function provisionAndLogCvm(vmConfig: any) {
  const provisionSpinner = logger.startSpinner('Provisioning CVM for on-chain KMS...');
  const provisionResponse = await provisionCvm(vmConfig);
  provisionSpinner.stop(true);

  if (!provisionResponse) {
    throw new Error('Failed to provision CVM for on-chain KMS');
  }

  logger.success('CVM provisioned successfully!');
  logger.keyValueTable({
    'App ID': provisionResponse.app_id,
    'Device ID': provisionResponse.device_id,
    'Compose Hash': provisionResponse.compose_hash,
    'OS Image Hash': provisionResponse.os_image_hash,
  });

  return provisionResponse;
}

/**
 * Creates the final CVM with encrypted environment variables.
 */
async function createFinalCvm(appAuthResult: any, provisionResponse: any, envs: EnvVar[], teepods: TeepodResponse, options: any) {
  logger.info('\nStep 4: Encrypting environment variables and creating final CVM...');
  let encrypted_env = '';
  let kmsId = teepods.kms_list[0].id;
  if (options.kmsId) {
    kmsId = options.kmsId;
    logger.info(`Using custom KMS ID: ${kmsId}`);
  }

  // Use custom app-id if provided, otherwise use the one from appAuthResult
  const appId = options.customAppId ? options.customAppId : appAuthResult.appId;
  if (options.customAppId) {
    logger.info(`Using custom App ID: ${appId}`);
  }
  if (envs.length > 0) {
    const spinner = logger.startSpinner('Fetching public key from KMS...');
    const { public_key } = await getKmsPubkey(kmsId, appId);
    spinner.stop(true);
    if (public_key) {
      const encryptSpinner = logger.startSpinner('Encrypting environment variables...');
      encrypted_env = await encryptEnvVars(envs, public_key);
      encryptSpinner.stop(true);
    }
  }

  const finalVmConfig = {
    app_id: ensureHexPrefix(appId),
    compose_hash: provisionResponse.compose_hash,
    contract_address: ensureHexPrefix(appAuthResult.proxyAddress),
    deployer_address: appAuthResult.deployerAddress ? ensureHexPrefix(appAuthResult.deployerAddress) : '',
    encrypted_env: encrypted_env,
    kms_id: kmsId,
  };

  const createSpinner = logger.startSpinner('Creating final CVM...');
  const finalResponse = await createCvmOnChainKms(finalVmConfig);
  createSpinner.stop(true);

  if (!finalResponse) {
    throw new Error('Failed to create CVM');
  }

  logger.success('CVM created successfully!');
  logger.break();
  logger.keyValueTable({
    'CVM ID': finalResponse.vm_uuid.replace(/-/g, ''),
    'Name': finalResponse.name,
    'Status': finalResponse.status,
    'App ID': finalResponse.app_id,
    'Endpoint': `${CLOUD_URL}/dashboard/cvms/${finalResponse.vm_uuid.replace(/-/g, '')}`,
  });
}

async function executeStandardCreation(vmConfig: any, envs: EnvVar[], options: any) {
  const spinner = logger.startSpinner('Getting public key from CVM');
  const pubkey = await getPubkeyFromCvm(vmConfig);
  spinner.stop(true);
  if (!pubkey) throw new Error('Failed to get public key from CVM');

  const encryptSpinner = logger.startSpinner('Encrypting environment variables');
  const encrypted_env = await encryptEnvVars(envs, pubkey.app_env_encrypt_pubkey);
  encryptSpinner.stop(true);

  const createSpinner = logger.startSpinner('Provisioning CVM');
  const response = await createCvm({ ...vmConfig, encrypted_env, app_env_encrypt_pubkey: pubkey.app_env_encrypt_pubkey, app_id_salt: pubkey.app_id_salt });
  createSpinner.stop(true);
  if (!response) throw new Error('Failed to create CVM');

  logger.success('CVM created successfully');
  logger.break();
  const tableData: { [key: string]: any } = {
    'CVM ID': response.vm_uuid.replace(/-/g, ''),
    'App ID': response.app_id,
    'Name': response.name,
    'Status': response.status,
    'Endpoint': `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
    'Created At': new Date(response.created_at).toLocaleString(),
  };
  if (response.kms_contract_address) tableData['KMS Contract Address'] = response.kms_contract_address;
  if (response.kms_owner_address) tableData['KMS Owner Address'] = response.kms_owner_address;
  logger.keyValueTable(tableData);
}

export const deployCommand = new Command()
  .name('deploy')
  .description('Create a new CVM with on-chain KMS in one step.')
  // CVM options
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory in MB, default is ${DEFAULT_MEMORY}`)
  .option('--disk-size <diskSize>', `Disk size in GB, default is ${DEFAULT_DISK_SIZE}`)
  .option('--teepod-id <teepodId>', 'TEEPod ID to use.')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--kms-id <kmsId>', 'KMS ID to use.')
  .option('--custom-app-id <customAppId>', 'Custom App ID to use.')
  .option('--pre-launch-script <preLaunchScript>', 'Path to pre-launch script')
  // Blockchain options
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .action(async (options) => {
    try {
      // Step 1: Gather CVM configuration
      logger.info('Step 1: Preparing CVM configuration...');
      const { vmConfig, envs, teepods, kmsContractAddress } = await gatherCvmConfig(options);

      // If no KMS ID is provided, use standard creation
      if (!options.kmsId) {
        executeStandardCreation(vmConfig, envs, options);
        return;
      }
      // Step 2: Provision the CVM
      logger.info('\nStep 2: Provisioning CVM...');
      const provisionResponse = await provisionAndLogCvm(vmConfig);

      // Step 3: Configure network and handle AppAuth
      logger.info('\nStep 3: Configuring network and setting up AppAuth...');

      let wallet = null;

      // Only create wallet if we need to deploy or register a contract
      if (!options.customAppId) {
        const privateKey = options.privateKey || process.env.PRIVATE_KEY;
        if (!privateKey) {
          throw new Error('Private key is required for on-chain KMS operations if no custom app ID is provided. Please provide it via --private-key or PRIVATE_KEY environment variable');
        }
        wallet = new ethers.Wallet(privateKey);
        logger.info(`Using wallet: ${wallet.address}`);
      }

      const deployOptions = {
        ...options,
        initialDeviceId: provisionResponse.device_id,
        composeHash: provisionResponse.compose_hash
      };

      let appAuthResult;

      // Handle custom app ID case - fetch AppAuth contract details from KMS
      if (options.customAppId) {
        logger.info(`Using custom App ID: ${options.customAppId}, fetching AppAuth details from KMS...`);

        // Initialize public client for Base Mainnet
        const publicClient = createPublicClient({
          chain: base,
          transport: http('https://mainnet.base.org')
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

          if (!ethers.isAddress(options.customAppId)) {
            throw new Error(`Invalid custom App ID: ${options.customAppId}`);
          }

          // Ensure customAppId has 0x prefix
          const customAppId = options.customAppId.startsWith('0x') 
            ? options.customAppId 
            : `0x${options.customAppId}`;
            
          // Query the KMS contract for app registration details
          const [isRegistered, controllerAddress] = await publicClient.readContract({
            address: kmsContractAddress as `0x${string}`,
            abi: kmsAuthAbi,
            functionName: 'apps',
            args: [customAppId as `0x${string}`]
          });

          // Validate the response
          if (!isRegistered) {
            throw new Error(`App ${options.customAppId} is not registered in KMS contract ${kmsContractAddress}`);
          }

          if (!controllerAddress || controllerAddress === ethers.ZeroAddress) {
            throw new Error(`Invalid controller address for app ${options.customAppId}`);
          }

          logger.info(`Successfully verified AppAuth contract at ${controllerAddress}`);

          appAuthResult = {
            appId: options.customAppId,
            proxyAddress: controllerAddress,
            deployerAddress: ''
          };

        } catch (error) {
          throw new Error(`Failed to verify custom App ID: ${error instanceof Error ? error.message : String(error)}`);
        }

      } else {
        if (!wallet) {
          throw new Error('Wallet is required when not using a custom App ID');
        }
        appAuthResult = await handleAppAuthDeployment(deployOptions, wallet, kmsContractAddress);
      }

      // Step 4: Create the final CVM
      await createFinalCvm(appAuthResult, provisionResponse, envs, teepods, options);

    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
