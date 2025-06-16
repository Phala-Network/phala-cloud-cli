import { Command } from 'commander';
import { createCvm, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod, Image, TeepodResponse } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_IMAGE, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { deleteSimulatorEndpointEnv } from '@/src/utils/simulator';

async function gatherAndValidateInputs(options: any) {
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

  let envs: EnvVar[] = [];
  if (options.envFile) {
    envs = parseEnv([], options.envFile);
  } else if (!options.skipEnv) {
    const { useEnvFile } = await inquirer.prompt([{ type: 'confirm', name: 'useEnvFile', message: 'Do you want to provide an environment file?', default: false }]);
    if (useEnvFile) {
      const envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
      envs = parseEnv([], envFilePath);
    }
  }

  const vcpu = Number(options.vcpu) || DEFAULT_VCPU;
  const memory = Number(options.memory) || DEFAULT_MEMORY;
  const diskSize = Number(options.diskSize) || DEFAULT_DISK_SIZE;

  if (Number.isNaN(vcpu) || vcpu <= 0) throw new Error(`Invalid number of vCPUs: ${options.vcpu}`);
  if (Number.isNaN(memory) || memory <= 0) throw new Error(`Invalid memory: ${options.memory}`);
  if (Number.isNaN(diskSize) || diskSize <= 0) throw new Error(`Invalid disk size: ${options.diskSize}`);

  return { composeString, envs };
}

async function selectHardwareAndImage(options: any, onchainKmsEnabled: boolean) {
  const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
  const teepods = await getTeepods();
  teepodsSpinner.stop(true);
  if (teepods.nodes.length === 0) {
    throw new Error('No TEEPods available. Please try again later.');
  }

  const availableTeepods = teepods.nodes.filter(teepod => !!teepod.support_onchain_kms === onchainKmsEnabled);
  if (availableTeepods.length === 0) {
    throw new Error(onchainKmsEnabled ? 'No TEEPods available that support on-chain KMS.' : 'No TEEPods available for standard creation.');
  }

  let selectedTeepod: TEEPod;
  if (options.teepodId) {
    selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.teepodId));
    if (!selectedTeepod) {
      throw new Error(onchainKmsEnabled ? `Selected TEEPod with ID ${options.teepodId} is not available or does not support on-chain KMS.` : `Failed to find selected TEEPod with ID ${options.teepodId}.`);
    }
  } else {
    const { teepod } = await inquirer.prompt([{
      type: 'list',
      name: 'teepod',
      message: 'Select a TEEPod to use:',
      choices: availableTeepods.map(t => ({ name: `${t.name} (ID: ${t.teepod_id}, vCPUs: ${t.remaining_vcpu}, Memory: ${t.remaining_memory}MB)`, value: t }))
    }]);
    selectedTeepod = teepod;
  }

  let selectedImage: Image;
  if (options.image) {
    selectedImage = selectedTeepod.images?.find(image => image.name === options.image);
    if (!selectedImage) throw new Error(`Failed to find selected image '${options.image}' for the selected TEEPod.`);
  } else {
    const defaultImageName = onchainKmsEnabled ? DEFAULT_ONCHAIN_IMAGE : DEFAULT_IMAGE;
    selectedImage = selectedTeepod.images?.find(image => image.name === defaultImageName);
    if (!selectedImage) throw new Error(`Failed to find default image ${defaultImageName} for the selected TEEPod.`);
  }
  return { selectedTeepod, selectedImage, teepods };
}

async function getAllowedEnvs(options: any) {
  if (options.allowedEnvs) {
    return options.allowedEnvs.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  const { envsStr } = await inquirer.prompt([{
    type: 'input',
    name: 'envsStr',
    message: 'Enter allowed environment variables (comma-separated), or leave blank if none:',
  }]);
  return envsStr ? envsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
}

function buildVmConfig(options: any, composeString: string, selectedTeepod: TEEPod, selectedImage: Image, allowedEnvs: string[]) {
  return {
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
}

async function executeStandardCreation(vmConfig: any, envs: EnvVar[], options: any) {
  const spinner = logger.startSpinner('Getting public key from CVM');
  const pubkey = await getPubkeyFromCvm(vmConfig);
  spinner.stop(true);
  if (!pubkey) throw new Error('Failed to get public key from CVM');

  const encryptSpinner = logger.startSpinner('Encrypting environment variables');
  const encrypted_env = await encryptEnvVars(envs, pubkey.app_env_encrypt_pubkey);
  encryptSpinner.stop(true);

  if (options.debug) {
    logger.debug('Public key:', pubkey.app_env_encrypt_pubkey);
    logger.debug('Encrypted environment variables:', encrypted_env);
    logger.debug('Environment variables:', JSON.stringify(envs));
  }

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

async function executeOnchainProvisioning(vmConfig: any, teepods: TeepodResponse) {
  if (!teepods.kms_list || teepods.kms_list.length === 0) {
    throw new Error('No KMS instances available for on-chain KMS.');
  }

  await inquirer.prompt([{
    type: 'list',
    name: 'selectedKmsId',
    message: 'Select a KMS instance to use:',
    choices: teepods.kms_list.map(kms => ({ name: `${kms.url} (ID: ${kms.id})`, value: kms.id }))
  }]);

  const createSpinner = logger.startSpinner('Provisioning CVM for on-chain KMS...');
  const response = await provisionCvm(vmConfig);
  createSpinner.stop(true);
  if (!response) throw new Error('Failed to provision CVM for on-chain KMS');

  logger.success('CVM provisioned for on-chain KMS successfully!');
  logger.info('Please use the following details for `kms deploy` and `cvms provision` commands.');
  logger.break();
  logger.keyValueTable({
    'Device ID': response.device_id,
    'Compose Hash': response.compose_hash,
    'OS Image Hash': response.os_image_hash,
  });
}

export const createCommand = new Command()
  .name('create')
  .description('Create a new CVM, with optional on-chain KMS integration.')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory in MB, default is ${DEFAULT_MEMORY}`)
  .option('--disk-size <diskSize>', `Disk size in GB, default is ${DEFAULT_DISK_SIZE}`)
  .option('--teepod-id <teepodId>', 'TEEPod ID to use.')
  .option('--image <image>', 'Version of dstack image to use.')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--debug', 'Enable debug mode', false)
  .option('--use-onchain-kms', 'Flag to enable on-chain KMS integration.', false)
  .option('--allowed-envs <allowedEnvs>', 'Allowed environment variables for the CVM.')
  .action(async (options) => {
    try {
      const { composeString, envs } = await gatherAndValidateInputs(options);
      await deleteSimulatorEndpointEnv();

      if (process.env.DSTACK_DOCKER_USERNAME && process.env.DSTACK_DOCKER_PASSWORD) {
        logger.info("🔐 Using private DockerHub registry credentials...");
      } else if (process.env.DSTACK_AWS_ACCESS_KEY_ID && process.env.DSTACK_AWS_SECRET_ACCESS_KEY && process.env.DSTACK_AWS_REGION && process.env.DSTACK_AWS_ECR_REGISTRY) {
        logger.info(`🔐 Using private AWS ECR registry: ${process.env.DSTACK_AWS_ECR_REGISTRY}`);
      } else {
        logger.info("🔐 Using public DockerHub registry...");
      }

      const onchainKmsEnabled = !!options.useOnchainKms;
      const { selectedTeepod, selectedImage, teepods } = await selectHardwareAndImage(options, onchainKmsEnabled);
      const allowedEnvs = await getAllowedEnvs(options);
      const vmConfig = buildVmConfig(options, composeString, selectedTeepod, selectedImage, allowedEnvs);

      if (onchainKmsEnabled) {
        await executeOnchainProvisioning(vmConfig, teepods);
      } else {
        await executeStandardCreation(vmConfig, envs, options);
      }
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
