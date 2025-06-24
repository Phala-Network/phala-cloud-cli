import { Command } from 'commander';
import { createCvmOnChainKms, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod, TeepodResponse } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey } from '@/src/api/kms';
import { getNetworkConfig, handleAppAuthDeployment, ensureHexPrefix } from '@/src/utils/blockchain';
import { ethers } from 'ethers';

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

  const availableTeepods = teepods.nodes.filter(teepod => teepod.support_onchain_kms);
  if (availableTeepods.length === 0) {
    throw new Error('No TEEPods available that support on-chain KMS.');
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

  const vmConfig = {
    teepod_id: selectedTeepod.teepod_id,
    name: options.name,
    image: selectedImage.name,
    vcpu: Number(options.vcpu) || DEFAULT_VCPU,
    memory: Number(options.memory) || DEFAULT_MEMORY,
    disk_size: Number(options.diskSize) || DEFAULT_DISK_SIZE,
    compose_file: {
      docker_compose_file: composeString,
      allowed_envs: allowedEnvs,
      features: ['kms', 'tproxy-net'],
      kms_enabled: true,
      manifest_version: 2,
      name: options.name,
      public_logs: true,
      public_sysinfo: true,
      tproxy_enabled: true,
    },
    listed: false,
  };

  return { vmConfig, envs, teepods };
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
    'Device ID': provisionResponse.device_id,
    'Compose Hash': provisionResponse.compose_hash,
    'OS Image Hash': provisionResponse.os_image_hash,
  });

  return provisionResponse;
}

/**
 * Creates the final CVM with encrypted environment variables.
 */
async function createFinalCvm(appAuthResult: any, provisionResponse: any, envs: EnvVar[], teepods: TeepodResponse) {
  logger.info('\nStep 4: Encrypting environment variables and creating final CVM...');
  let encrypted_env = '';
  if (envs.length > 0) {
    const spinner = logger.startSpinner('Fetching public key from KMS...');
    const { public_key } = await getKmsPubkey(teepods.kms_list[0].id, appAuthResult.appId);
    spinner.stop(true);
    if (public_key) {
      const encryptSpinner = logger.startSpinner('Encrypting environment variables...');
      encrypted_env = await encryptEnvVars(envs, public_key);
      encryptSpinner.stop(true);
    }
  }

  const finalVmConfig = {
    app_id: ensureHexPrefix(appAuthResult.appId),
    compose_hash: provisionResponse.compose_hash,
    contract_address: ensureHexPrefix(appAuthResult.proxyAddress),
    deployer_address: ensureHexPrefix(appAuthResult.deployerAddress),
    encrypted_env: encrypted_env,
    kms_id: teepods.kms_list[0].id,
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

export const onchainCreateCommand = new Command()
  .name('onchain-create')
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
  // Blockchain options
  .option('--kms-contract-address <kmsContractAddress>', 'Address of the main KmsAuth contract.')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--network <network>', 'The network to deploy to (e.g., hardhat, phala, sepolia, test)')
  .option('--rpc-url <rpc-url>', 'RPC URL for the blockchain.')
  .option('--deployer-address <deployerAddress>', 'Address of the owner for the new AppAuth instance.')
  .option('--app-auth-address <appAuthAddress>', 'Register a pre-deployed AppAuth contract at this address.')
  .option('--app-auth-contract-path <appAuthContractPath>', 'Path to a custom AppAuth contract file (currently disabled).')
  .option('--use-default-app-auth <useDefaultAppAuth>', 'Use the default AppAuth contract for deployment.', true)
  .action(async (options) => {
    try {
      // Step 1: Gather CVM configuration
      logger.info('Step 1: Preparing CVM configuration...');
      const { vmConfig, envs, teepods } = await gatherCvmConfig(options);

      // Step 2: Provision the CVM
      logger.info('\nStep 2: Provisioning CVM...');
      const provisionResponse = await provisionAndLogCvm(vmConfig);

      // Step 3: Configure network and deploy contract
      logger.info('\nStep 3: Configuring network and deploying AppAuth contract...');
      const { wallet, ...networkConfig } = await getNetworkConfig(options);
      const deployOptions = {
        ...options,
        ...networkConfig,
        initialDeviceId: provisionResponse.device_id,
        composeHash: provisionResponse.compose_hash
      };

      if (!deployOptions.kmsContractAddress) {
        const { addr } = await inquirer.prompt([{
          type: 'input',
          name: 'addr',
          message: 'Enter the address of the main KmsAuth contract:',
          validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
        }]);
        deployOptions.kmsContractAddress = addr;
      }

      const appAuthResult = await handleAppAuthDeployment(deployOptions, wallet, deployOptions.kmsContractAddress);

      // Step 4: Create the final CVM
      await createFinalCvm(appAuthResult, provisionResponse, envs, teepods);

    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
