import { Command } from 'commander';
import { createCvm, createCvmOnChainKms, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import type { TEEPod, TeepodResponse } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL } from '@/src/utils/constants';
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
    let folderName = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    // Ensure folder name is at least 3 characters by appending 'cvm' if needed
    if (folderName.length < 3) {
      folderName = folderName + '-cvm';
    }
    const validFolderName = folderName.slice(0, 20); // Ensure max length of 20
    
    if (!options.interactive) {
      options.name = validFolderName;
    } else {
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for the CVM:',
          default: validFolderName,
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
      logger.info('Docker Compose file is required.\n\nUsage examples:\n  phala deploy --compose docker-compose.yml \n  phala deploy --compose docker-compose.yml --node-id 6 --kms-id t16z-dev --private-key <your-private-key> --rpc-url <rpc-url>\n\nMinimal required parameters:\n  --compose <path>    Path to docker-compose.yml\n\nFor on-chain KMS, also provide:\n  --kms-id <id>       KMS ID\n  --private-key <key> Private key for deployment\n\nRun with --interactive for guided setup');
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
  let envFilePath = options.envFile;

  // Handle environment file path resolution
  if (options.interactive && (!options.envFile || envFilePath === true)) {
    envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
  } else if (!options.envFile || envFilePath === true) {
    logger.info('Environment file not specified. Skipping environment variables.');
  }

  if (envFilePath && envFilePath !== true) {
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
      throw new Error(`Error reading environment file ${envFilePath}:`, error);
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
    // Try to find KMS by ID first, then by slug
    kmsInfo = allKmsInfos.find(kms => kms.id === options.kmsId || kms.slug === options.kmsId);

    if (!kmsInfo) {
      throw new Error(`No KMS found with ID or slug: ${options.kmsId} in the available Nodes`);
    }

    kmsContractAddress = kmsInfo.kms_contract_address;
    logger.info(`Using DstackKms contract address: ${kmsContractAddress} from KMS ID: ${options.kmsId}`);
  }

  let selectedTeepod: TEEPod;
  if (options.nodeId) {
    selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.nodeId));
    if (!selectedTeepod) {
      throw new Error(`Selected Node with ID ${options.nodeId} is not available or does not support on-chain KMS.`);
    }
  } else if (options.kmsId) {
    // For on-chain KMS, node-id is required
    if (!options.interactive) {
      logger.info('Node is required for on-chain KMS. Use --node-id to select it');
      process.exit(1);
    } else {
      const { node } = await inquirer.prompt([{ 
        type: 'list', 
        name: 'node', 
        message: 'Select a Node to use:', 
        choices: availableTeepods.map(t => ({ 
          name: `${t.name} (Region: ${t.region_identifier})`, 
          value: t 
        })) 
      }]);
      selectedTeepod = node;
    }
  } else {
    // For standard CVM, use the first available node if not specified
    selectedTeepod = availableTeepods[0];
    logger.info(`Using default node: ${selectedTeepod.name} (ID: ${selectedTeepod.teepod_id}, Region: ${selectedTeepod.region_identifier})`);
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
    node_id: selectedTeepod.teepod_id,
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
      app_id: provisionResponse.app_id,
      device_id: provisionResponse.device_id,
      compose_hash: provisionResponse.compose_hash,
      os_image_hash: provisionResponse.os_image_hash,
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
  let encrypted_env = '';
  let kmsId = teepods.kms_list[0].id;
  if (options.kmsId) {
    kmsId = options.kmsId;
  }

  const appId = appAuthResult.appId;
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

  const result = {
    success: true,
    vm_uuid: finalResponse.vm_uuid.replace(/-/g, ''),
    name: finalResponse.name,
    app_id: finalResponse.app_id,
    endpoint: `${CLOUD_URL}/dashboard/cvms/${finalResponse.vm_uuid.replace(/-/g, '')}`,
  } as const;

  if (options.json !== false) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.success('CVM created successfully!');
    logger.break();
    logger.keyValueTable({
      'CVM ID': result.vm_uuid,
      'Name': result.name,
      'App ID': result.app_id,
      'Endpoint': result.endpoint,
    });
  }

  return result;
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

  const result = {
    success: true,
    vm_uuid: response.vm_uuid.replace(/-/g, ''),
    app_id: response.app_id,
    name: response.name,
    endpoint: `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
    created_at: response.created_at,
    ...(response.kms_contract_address && { kms_contract_address: response.kms_contract_address }),
    ...(response.kms_owner_address && { kms_owner_address: response.kms_owner_address })
  } as const;

  if (options?.json !== false) {
    console.log(JSON.stringify({
      success: true,
      cvm_id: result.vm_uuid,
      app_id: result.app_id,
      name: result.name,
      endpoint: result.endpoint,
      created_at: result.created_at,
      ...(result.kms_contract_address && { kms_contract_address: result.kms_contract_address }),
      ...(result.kms_owner_address && { kms_owner_address: result.kms_owner_address })
    }, null, 2));
  } else {
    logger.success('CVM created successfully');
    logger.break();
    const tableData: { [key: string]: any } = {
      'CVM ID': result.vm_uuid,
      'App ID': result.app_id,
      'Name': result.name,
      'Endpoint': result.endpoint,
      'Created At': new Date(result.created_at).toLocaleString(),
    };
    if (result.kms_contract_address) tableData['KMS Contract Address'] = result.kms_contract_address;
    if (result.kms_owner_address) tableData['KMS Owner Address'] = result.kms_owner_address;
    logger.keyValueTable(tableData);
  }

  return result;
}

export const deployCommand = new Command()
  .command('deploy [compose]')
  .description('Create a new CVM with on-chain KMS in one step.')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .option('--debug', 'Enable debug logging', false)
  // CVM options
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file (default: docker-compose.yml in current directory)')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory with optional unit (e.g., 2G, 500MB, 1024), default is ${DEFAULT_MEMORY}MB`)
  .option('--disk-size <diskSize>', `Disk size with optional unit (e.g., 50G, 1T, 100), default is ${DEFAULT_DISK_SIZE}GB`)
  .option('--image <image>', 'Version of dstack image to use')
  .option('--node-id <nodeId>', 'Node ID to use')
  .option('-e, --env-file <envFile>', 'Prompt for environment variables and save to file (optional)')
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--kms-id <kmsId>', 'KMS ID to use.')
  .option('--custom-app-id <customAppId>', 'Custom App ID to use.')
  .option('--pre-launch-script <preLaunchScript>', 'Path to pre-launch script')
  // Blockchain options
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .action(async (composeFile: string | undefined, options: {
    name?: string;
    compose?: string;
    vcpu?: string;
    memory?: string;
    diskSize?: string;
    image?: string;
    nodeId?: string;
    envFile?: string | boolean;
    interactive?: boolean;
    kmsId?: string;
    customAppId?: string;
    preLaunchScript?: string;
    privateKey?: string;
    rpcUrl?: string;
    json?: boolean;
    debug?: boolean;
  }, command: Command) => {
    try {
      // Use the compose file from the first argument if provided, otherwise use the one from options or default to 'docker-compose.yml'
      const finalOptions = {
        ...options,
        compose: composeFile || options.compose || 'docker-compose.yml' || 'docker-compose.yaml'
      };

      // Step 1: Gather CVM configuration
      const { vmConfig, envs, teepods, kmsContractAddress } = await gatherCvmConfig(finalOptions);

      // If no KMS ID is provided, use standard creation
      if (!options.kmsId) {
        const result = await executeStandardCreation(vmConfig, envs, {
          json: options.json,
          debug: options.debug
        });
        // Store the successful result in the command object
        setCommandResult(command, result);
        return;
      }
      // Step 2: Provision the CVM
      const provisionResponse = await provisionAndLogCvm(vmConfig);

      // Step 3: Configure network and handle AppAuth
      let wallet = null;
      let selectedKms = teepods.kms_list?.[0];

      // If kms-id is provided, find the corresponding KMS info
      if (options.kmsId) {
        selectedKms = teepods.kms_list?.find(kms => kms.id === options.kmsId || kms.slug === options.kmsId);
        if (!selectedKms) {
          throw new Error(`No KMS found with ID or slug: ${options.kmsId}`);
        }
        if (options.json === false) {
          logger.info(`Using specified KMS: ${selectedKms.name} (${selectedKms.id})`);
        }
      }
      // Get the chain config for the selected KMS
      const chain = getChainConfig(selectedKms.chain_id);
      const rpcUrl = options.rpcUrl || selectedKms.url || chain.rpcUrls.default.http[0];

      // Only create wallet if we need to deploy or register a contract
      if (!options.customAppId) {
        const privateKey = options.privateKey || process.env.PRIVATE_KEY;
        if (!privateKey) {
          throw new Error('Private key is required for on-chain KMS operations if no custom app ID is provided. Please provide it via --private-key or PRIVATE_KEY environment variable');
        }
                
        const networkConfig = await getNetworkConfig({ privateKey, rpcUrl }, selectedKms.chain_id);
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

      let appAuthResult;

      // Handle custom app ID case - fetch AppAuth contract details from KMS
      if (options.customAppId) {
        if (options.json === false) {
          logger.info(`Using custom App ID: ${options.customAppId}, fetching DstackApp details from DstackKms...`);
        }

        // Use the selected KMS or the first available one
        const kms = selectedKms || teepods.kms_list?.[0];
        if (!kms) {
          throw new Error('No KMS available');
        }

        // Get the chain config and determine the RPC URL with proper fallback
        const chain = getChainConfig(kms.chain_id);
        const rpcUrl = (options.rpcUrl || kms.url || chain.rpcUrls.default.http[0]) as string;

        // Initialize public client with the appropriate chain and RPC URL
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl)
        });

        // KMS Auth ABI for reading app registration details
        const kmsAuthAbi = [
          {
            inputs: [{ name: '', type: 'address' }],
            name: 'registeredApps',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'view',
            type: 'function',
          },
        ] as const;

        try {
          // Ensure the KMS contract address is valid
          if (!ethers.isAddress(kmsContractAddress)) {
            throw new Error(`Invalid DstackKms contract address: ${kmsContractAddress}`);
          }

          // Remove 'app_' prefix if present
          const cleanAppId = options.customAppId.startsWith('app_')
            ? options.customAppId.substring(4)
            : options.customAppId;

          if (!ethers.isAddress(cleanAppId)) {
            throw new Error(`Invalid custom App ID: ${options.customAppId}`);
          }

          // Ensure customAppId has 0x prefix
          const customAppId = cleanAppId.startsWith('0x')
            ? cleanAppId
            : `0x${cleanAppId}`;

          // Query the KMS contract for app registration status
          const isRegistered: boolean = await publicClient.readContract({
            address: kmsContractAddress as `0x${string}`,
            abi: kmsAuthAbi,
            functionName: 'registeredApps',
            args: [customAppId as `0x${string}`]
          });

          // Validate the response
          if (!isRegistered) {
            throw new Error(`App ${customAppId} is not registered in DstackKms contract ${kmsContractAddress}`);
          }

          if (options.json === false) {
            logger.info(`Successfully verified DstackApp contract for app ${customAppId}`);
          }

          appAuthResult = {
            appId: customAppId,
            proxyAddress: customAppId,
            deployerAddress: ''
          };

        } catch (error) {
          throw new Error(`Failed to verify custom App ID: ${error instanceof Error ? error.message : String(error)}`);
        }

      } else {
        if (!wallet) {
          throw new Error('Wallet is required when not using a custom App ID');
        }
        appAuthResult = await handleAppAuthDeployment(deployOptions, wallet, kmsContractAddress, selectedKms.chain_id, rpcUrl);
      }

      // Step 4: Create the final CVM with encrypted environment variables
      const result = await createFinalCvm(appAuthResult, provisionResponse, envs, teepods, options);
      
      // Create a new object with the success flag and spread the result properties
      const commandResult = { success: true, ...result };
      
      // Store the successful result in the command object
      setCommandResult(command, commandResult);

    } catch (error) {
      const errorMessage = `Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`;
      const errorResult = {
        success: false,
        error: errorMessage,
        ...(options.debug && error instanceof Error && { stack: error.stack })
      };
      
      // Store the error in the command object
      setCommandError(command, new Error(errorMessage));
      
      if (options.json !== false) {
        console.error(JSON.stringify(errorResult, null, 2));
      } else {
        logger.error(errorMessage);
      }
    }
  });
