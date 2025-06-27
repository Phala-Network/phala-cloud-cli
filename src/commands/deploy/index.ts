import { Command } from 'commander';
import { createCvm, createCvmOnChainKms, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod, TeepodResponse } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey } from '@/src/api/kms';
import { handleAppAuthDeployment, ensureHexPrefix, getNetworkConfig, getChainConfig } from '../../utils/blockchain';
import { parseMemoryInput, parseDiskSizeInput } from '@/src/utils/units';
import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';

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
    if (!options.interactive) {
      const folderName = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      options.name = folderName;
    } else {
      // Use current directory name as default
      const folderName = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for the CVM:',
          default: folderName,
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
  }

  if (!options.compose) {
    if (!options.interactive) {
      logger.error('Docker Compose file is required. Use --compose or --interactive to select it');
      process.exit(1);
    } else {
      const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
      const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
      options.compose = await promptForFile('Enter the path to your Docker Compose file:', composeFileName, 'file');
    }
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

  const teepodsSpinner = logger.startSpinner('Fetching available Nodes');
  const teepods = await getTeepods();
  teepodsSpinner.stop(true);
  if (teepods.nodes.length === 0) {
    throw new Error('No Nodes available.');
  }

  // Filter TEEpods based on on-chain KMS support
  let availableTeepods = teepods.nodes.filter(teepod =>
    options.kmsId ? teepod.support_onchain_kms : !teepod.support_onchain_kms
  );

  if (availableTeepods.length === 0) {
    const errorMessage = options.kmsId
      ? 'No Nodes available that support on-chain KMS.'
      : 'No Nodes available that does not support on-chain KMS.';
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
      throw new Error(`No KMS found with ID: ${options.kmsId} in the available Nodes`);
    }

    kmsContractAddress = kmsInfo.kms_contract_address;
    logger.info(`Using KMS contract address: ${kmsContractAddress} from KMS ID: ${options.kmsId}`);
  }

  let selectedTeepod: TEEPod;
  if (options.nodeId) {
    selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.nodeId));
    if (!selectedTeepod) {
      throw new Error(`Selected Node with ID ${options.nodeId} is not available or does not support on-chain KMS.`);
    }
  } else {
    if (!options.interactive) {
      logger.error('Node is required. Use --node-id to select it');
      process.exit(1);
    } else {
      const { node } = await inquirer.prompt([{ type: 'list', name: 'node', message: 'Select a Node to use:', choices: availableTeepods.map(t => ({ name: `${t.name} (Region: ${t.region_identifier})`, value: t })) }]);
      selectedTeepod = node;
    }
  }

  let selectedImage;
  if (options.image) {
    selectedImage = selectedTeepod.images?.find(image => image.name === options.image);
    if (!selectedImage) throw new Error(`Failed to find selected image '${options.image}' for the selected Node.`);
  } else {
    selectedImage = selectedTeepod.images?.[0];
    if (!selectedImage) {
      throw new Error('No images found for the selected Node.');
    }
    logger.info(`Using image: ${selectedImage.name}`);
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

  // Parse memory and disk size with units
  let memoryMB = DEFAULT_MEMORY;
  if (options.memory) {
    try {
      memoryMB = parseMemoryInput(options.memory);
      logger.info(`Using memory: ${memoryMB}MB (parsed from: ${options.memory})`);
    } catch (error) {
      logger.warn(`Invalid memory format '${options.memory}'. Using default: ${DEFAULT_MEMORY}MB`);
    }
  }

  let diskSizeGB = DEFAULT_DISK_SIZE;
  if (options.diskSize) {
    try {
      diskSizeGB = parseDiskSizeInput(options.diskSize);
      logger.info(`Using disk size: ${diskSizeGB}GB (parsed from: ${options.diskSize})`);
    } catch (error) {
      logger.warn(`Invalid disk size format '${options.diskSize}'. Using default: ${DEFAULT_DISK_SIZE}GB`);
    }
  }

  const vmConfig = {
    teepod_id: selectedTeepod.teepod_id,
    name: options.name,
    image: selectedImage.name,
    vcpu: Number(options.vcpu) || DEFAULT_VCPU,
    memory: memoryMB,
    disk_size: diskSizeGB,
    compose_file: composeFile,
    listed: false,
  }

  return { vmConfig, envs, teepods, kmsContractAddress };
}

/**
 * Provisions the CVM and logs the result.
 */
async function provisionAndLogCvm(vmConfig: any, options: { json?: boolean } = {}) {
  const provisionSpinner = logger.startSpinner('Provisioning CVM for on-chain KMS...');
  const provisionResponse = await provisionCvm(vmConfig);
  provisionSpinner.stop(true);

  if (!provisionResponse) {
    throw new Error('Failed to provision CVM for on-chain KMS');
  }

  if (options?.json !== false) {
    console.log(JSON.stringify({
      success: true,
      data: {
        app_id: provisionResponse.app_id,
        device_id: provisionResponse.device_id,
        compose_hash: provisionResponse.compose_hash,
        os_image_hash: provisionResponse.os_image_hash,
        raw: provisionResponse
      }
    }, null, 2));
  } else {
    logger.success('CVM provisioned successfully!');
    logger.keyValueTable({
      'App ID': provisionResponse.app_id,
      'Device ID': provisionResponse.device_id,
      'Compose Hash': provisionResponse.compose_hash,
      'OS Image Hash': provisionResponse.os_image_hash,
    });
  }

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

  if (options?.json !== false) {
    console.log(JSON.stringify({
      success: true,
      data: {
        vm_uuid: finalResponse.vm_uuid.replace(/-/g, ''),
        name: finalResponse.name,
        status: finalResponse.status,
        app_id: finalResponse.app_id,
        endpoint: `${CLOUD_URL}/dashboard/cvms/${finalResponse.vm_uuid.replace(/-/g, '')}`,
        raw: finalResponse
      }
    }, null, 2));
  } else {
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
}

async function executeStandardCreation(
  vmConfig: any,
  envs: EnvVar[],
  options: { json?: boolean; debug?: boolean } = {}
) {
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

  if (options?.json !== false) {
    const jsonOutput: any = {
      success: true,
      data: {
        cvm_id: response.vm_uuid.replace(/-/g, ''),
        app_id: response.app_id,
        name: response.name,
        status: response.status,
        endpoint: `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
        created_at: response.created_at,
        raw: response
      }
    };
    if (response.kms_contract_address) jsonOutput.data.kms_contract_address = response.kms_contract_address;
    if (response.kms_owner_address) jsonOutput.data.kms_owner_address = response.kms_owner_address;
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
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
}

export const deployCommand = new Command()
  .command('deploy')
  .description('Create a new CVM with on-chain KMS in one step.')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .option('--debug', 'Enable debug logging', false)
  // CVM options
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory with optional unit (e.g., 2G, 500MB, 1024), default is ${DEFAULT_MEMORY}MB`)
  .option('--disk-size <diskSize>', `Disk size with optional unit (e.g., 50G, 1T, 100), default is ${DEFAULT_DISK_SIZE}GB`)
  .option('--image <image>', 'Version of dstack image to use')
  .option('--node-id <nodeId>', 'Node ID to use')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--kms-id <kmsId>', 'KMS ID to use.')
  .option('--custom-app-id <customAppId>', 'Custom App ID to use.')
  .option('--pre-launch-script <preLaunchScript>', 'Path to pre-launch script')
  // Blockchain options
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .action(async (options: {
    name?: string;
    compose?: string;
    vcpu?: string;
    memory?: string;
    diskSize?: string;
    image?: string;
    nodeId?: string;
    envFile?: string;
    skipEnv?: boolean;
    interactive?: boolean;
    kmsId?: string;
    customAppId?: string;
    preLaunchScript?: string;
    privateKey?: string;
    rpcUrl?: string;
    json?: boolean;
    debug?: boolean;
  }) => {
    try {
      // Step 1: Gather CVM configuration
      logger.info('Step 1: Preparing CVM configuration...');
      const { vmConfig, envs, teepods, kmsContractAddress } = await gatherCvmConfig(options);

      // If no KMS ID is provided, use standard creation
      if (!options.kmsId) {
        await executeStandardCreation(vmConfig, envs, {
          json: options.json,
          debug: options.debug
        });
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
        const networkConfig = await getNetworkConfig({ privateKey, rpcUrl: options.rpcUrl }, teepods.kms_list[0].chain_id);
        wallet = networkConfig.wallet;
        if (options.json === false) {
          logger.info(`Using wallet: ${wallet.address}`);
        }
      }

      const deployOptions = {
        ...options,
        initialDeviceId: provisionResponse.device_id,
        composeHash: provisionResponse.compose_hash
      };
      console.log('deployOptions', deployOptions);

      let appAuthResult;

      // Handle custom app ID case - fetch AppAuth contract details from KMS
      if (options.customAppId) {
        if (options.json === false) {
          logger.info(`Using custom App ID: ${options.customAppId}, fetching AppAuth details from KMS...`);
        }

        // Get the first available KMS to determine the chain
        const kms = teepods.kms_list?.[0];
        if (!kms) {
          throw new Error('No KMS available');
        }

        // Get network config which will handle chain validation and RPC URL resolution
        const { rpcUrl } = await getNetworkConfig({ rpcUrl: options.rpcUrl }, kms.chain_id);
        
        // Get the chain config
        const chain = getChainConfig(kms.chain_id);
        
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

          if (options.json === false) {
            logger.info(`Successfully verified AppAuth contract at ${controllerAddress}`);
          }

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
      const errorMessage = `Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`;
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: options.debug && error instanceof Error ? error.stack : undefined
        }, null, 2));
      } else {
        logger.error(errorMessage);
      }
      process.exit(1);
    }
  });
