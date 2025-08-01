import { Command } from 'commander';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { createCvm, createCvmOnChainKms, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { parseMemoryInput, parseDiskSizeInput } from '@/src/utils/units';

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
      logger.info('Docker Compose file is required. Use --compose or --interactive to select it');
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

  // Only process environment variables if -e/--env-file is provided
  if (options.interactive && (!options.envFile || envFilePath === true)) {
    // In interactive mode, prompt for environment file if -e is specified without a value
    envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
  } else if (!options.envFile || envFilePath === true) {
    // Skip environment variables if not explicitly requested
    logger.info('Environment file not specified. Skipping environment variables.');
  }

  // Process the environment file if a valid path is provided
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
      throw new Error(`Error reading environment file ${envFilePath}: ${error}`);
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
    logger.info(`Using KMS contract address: ${kmsContractAddress} from KMS ID: ${options.kmsId}`);
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

  const vmConfig: any = {
    teepod_id: selectedTeepod.teepod_id,
    node_id: selectedTeepod.teepod_id,
    name: options.name,
    image: selectedImage.name,
    vcpu: Number(options.vcpu) || DEFAULT_VCPU,
    memory: memoryMB,
    disk_size: diskSizeGB,
    listed: false,
  };

  // Use compose_manifest for standard flow, compose_file for on-chain KMS
  if (options.kmsId) {
    vmConfig.compose_file = composeFile;
  } else {
    vmConfig.compose_manifest = composeFile;
  }

  return { vmConfig, envs, teepods, kmsContractAddress };
}

/**
 * Provisions the CVM and logs the result.
 */
async function provisionAndLogCvm(vmConfig: any, options: any) {
  const provisionSpinner = logger.startSpinner('Provisioning CVM for on-chain KMS...');
  const provisionResponse = await provisionCvm(vmConfig);
  provisionSpinner.stop(true);

  if (!provisionResponse) {
    throw new Error('Failed to provision CVM for on-chain KMS');
  }

  const result = {
    app_id: provisionResponse.app_id,
    device_id: provisionResponse.device_id,
    compose_hash: provisionResponse.compose_hash,
    os_image_hash: provisionResponse.os_image_hash,
    vm_uuid: provisionResponse.vm_uuid,
    name: provisionResponse.name,
    status: provisionResponse.status
  };

  if (options.json !== false) {
    console.log(JSON.stringify({
      success: true,
      data: result
    }, null, 2));
  } else {
    logger.success('CVM provisioned successfully!');
    logger.keyValueTable({
      'App ID': result.app_id,
      'Device ID': result.device_id,
      'Compose Hash': result.compose_hash,
      'OS Image Hash': result.os_image_hash
    });
  }
  
  return result;
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

  if (options.json !== false) {
    const jsonOutput: any = {
      success: true,
      cvm_id: response.vm_uuid.replace(/-/g, ''),
      app_id: response.app_id,
      name: response.name,
      endpoint: `${CLOUD_URL}/dashboard/cvms/${response.vm_uuid.replace(/-/g, '')}`,
      created_at: response.created_at
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
  
  return response;
}

export const provisionCommand = new Command()
  .name('provision')
  .description('Provision a new CVM, with optional on-chain KMS integration.')
  // CVM options
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory with optional unit (e.g., 2G, 500MB, 1024), default is ${DEFAULT_MEMORY}MB`)
  .option('--disk-size <diskSize>', `Disk size with optional unit (e.g., 50G, 1T, 100), default is ${DEFAULT_DISK_SIZE}GB`)
  .option('--image <image>', 'Version of dstack image to use')
  .option('--node-id <nodeId>', 'Node ID to use')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--kms-id <kmsId>', 'KMS ID to use.')
  .option('--pre-launch-script <preLaunchScript>', 'Path to pre-launch script')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .action(async function(this: Command, options) {
    try {
      // Step 1: Gather CVM configuration
      const { vmConfig, envs } = await gatherCvmConfig(options);

      let result;
      // If no KMS ID is provided, use standard creation
      if (!options.kmsId) {
        result = await executeStandardCreation(vmConfig, envs, options);
      } else {
        // Step 2: Provision the CVM with KMS
        result = await provisionAndLogCvm(vmConfig, options);
      }
      
      // Set command result for telemetry
      setCommandResult(this, {
        success: true,
        cvmId: result?.vm_uuid,
        appId: result?.app_id,
        name: result?.name,
        status: result?.status,
        kmsId: options.kmsId || null,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = options.debug && error instanceof Error ? error.stack : undefined;
      
      // Set command error for telemetry
      setCommandError(this, new Error(errorMessage));
      
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage,
          stack: errorStack
        }, null, 2));
      } else {
        logger.error(`Failed to create CVM: ${errorMessage}`);
      }
      
      // Don't call process.exit() as it prevents telemetry from being sent
      throw error;
    }
  });
