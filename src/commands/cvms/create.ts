import { Command } from 'commander';
import { createCvm, getPubkeyFromCvm, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod, Image } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_IMAGE, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { deleteSimulatorEndpointEnv } from '@/src/utils/simulator';

export const createCommand = new Command()
  .name('create')
  .description('Create a new CVM, with optional on-chain KMS integration.')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory in MB, default is ${DEFAULT_MEMORY}`)
  .option('--disk-size <diskSize>', `Disk size in GB, default is ${DEFAULT_DISK_SIZE}`)
  .option('--teepod-id <teepodId>', 'TEEPod ID to use. If not provided, it will be selected from the list of available TEEPods.')
  .option('--image <image>', 'Version of dstack image to use. If not provided, it will be selected from the list of available images for the selected TEEPod.')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--debug', 'Enable debug mode', false)
  .option('--use-onchain-kms', 'Flag to enable on-chain KMS integration.', false)
  .option('--allowed-envs <allowedEnvs>', 'Allowed environment variables for the CVM.')
  .option('--kms-id <kmsId>', 'KMS ID to use. If not provided, it will be selected from the list of available KMS instances.')
  .action(async (options) => {
    try {
      // Prompt for required options if not provided
      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for the CVM:',
            validate: (input) => {
              if (!input.trim()) {
                return 'CVM name is required';
              }
              if (input.trim().length > 20) {
                return 'CVM name must be less than 20 characters';
              }
              if (input.trim().length < 3) {
                return 'CVM name must be at least 3 characters';
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                return 'CVM name must contain only letters, numbers, underscores, and hyphens';
              }
              return true;
            }
          }
        ]);
        options.name = name;
      }

      // If compose path not provided, prompt with examples
      if (!options.compose) {
        const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
        const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');

        options.compose = await promptForFile(
          'Enter the path to your Docker Compose file:',
          composeFileName,
          'file'
        );
      }

      const composePath = path.resolve(options.compose);
      if (!fs.existsSync(composePath)) {
        logger.error(`Docker Compose file not found: ${composePath}`);
        process.exit(1);
      }
      const composeString = fs.readFileSync(composePath, 'utf8');

      // Delete DSTACK_SIMULATOR_ENDPOINT environment variable
      await deleteSimulatorEndpointEnv();

      // Print if they are using a private registry
      if (process.env.DSTACK_DOCKER_USERNAME && process.env.DSTACK_DOCKER_PASSWORD) {
        logger.info("🔐 Using private DockerHub registry credentials...");
      } else if (process.env.DSTACK_AWS_ACCESS_KEY_ID && process.env.DSTACK_AWS_SECRET_ACCESS_KEY && process.env.DSTACK_AWS_REGION && process.env.DSTACK_AWS_ECR_REGISTRY) {
        logger.info(`🔐 Using private AWS ECR registry: ${process.env.DSTACK_AWS_ECR_REGISTRY}`);
      } else {
        logger.info("🔐 Using public DockerHub registry...");
      }

      // Process environment variables
      let envs: EnvVar[] = [];

      // Process environment variables from file
      if (options.envFile) {
        try {
          envs = parseEnv([], options.envFile);
        } catch (error) {
          logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else if (!options.skipEnv) {
        // Prompt to input env file or skip
        const { shouldSkip } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldSkip',
            message: 'Do you want to skip environment variable prompt?',
            default: true
          }
        ]);

        if (shouldSkip) {
          logger.info('Skipping environment variable prompt');
        } else {
          const envVars = await promptForFile(
            'Enter the path to your environment file:',
            '.env',
            'file',
          );
          envs = parseEnv([], envVars);
        }
      }

      const vcpu = Number(options.vcpu) || DEFAULT_VCPU;
      const memory = Number(options.memory) || DEFAULT_MEMORY;
      const diskSize = Number(options.diskSize) || DEFAULT_DISK_SIZE;

      if (Number.isNaN(vcpu) || vcpu <= 0) {
        logger.error(`Invalid number of vCPUs: ${vcpu}`);
        process.exit(1);
      }

      if (Number.isNaN(memory) || memory <= 0) {
        logger.error(`Invalid memory: ${memory}`);
        process.exit(1);
      }

      if (Number.isNaN(diskSize) || diskSize <= 0) {
        logger.error(`Invalid disk size: ${diskSize}`);
        process.exit(1);
      }

      const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
      const teepods = await getTeepods();
      teepodsSpinner.stop(true);
      if (teepods.nodes.length === 0) {
        logger.error('No TEEPods available. Please try again later.');
        process.exit(1);
      }

      // Filter TEEPods based on on-chain KMS support
      const onchainKmsEnabled = !!options.useOnchainKms;
      const availableTeepods = teepods.nodes.filter(
        teepod => !!teepod.support_onchain_kms === onchainKmsEnabled
      );

      if (availableTeepods.length === 0) {
        const message = onchainKmsEnabled
          ? 'No TEEPods available that support on-chain KMS.'
          : 'No TEEPods available for standard creation.';
        logger.error(message);
        process.exit(1);
      }

      let selectedTeepod: TEEPod;
      if (options.teepodId) {
        selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.teepodId));
        if (!selectedTeepod) {
          const message = onchainKmsEnabled
            ? `Selected TEEPod with ID ${options.teepodId} is not available or does not support on-chain KMS.`
            : `Failed to find selected TEEPod with ID ${options.teepodId}.`;
          logger.error(message);
          process.exit(1);
        }
      } else {
        const { teepod } = await inquirer.prompt([
          {
            type: 'list',
            name: 'teepod',
            message: 'Select a TEEPod to use:',
            choices: availableTeepods.map(t => ({
              name: `${t.name} (ID: ${t.teepod_id}, Remaining vCPUs: ${t.remaining_vcpu}, Remaining Memory: ${t.remaining_memory}MB)`,
              value: t,
            })),
          },
        ]);
        selectedTeepod = teepod;
      }

      let selectedImage: Image;
      if (options.image) {
        // If user specifies an image, use it
        selectedImage = selectedTeepod.images?.find(image => image.name === options.image);
        if (!selectedImage) {
          logger.error(`Failed to find selected image '${options.image}' for the selected TEEPod.`);
          process.exit(1);
        }
      } else {
        // Otherwise, use the default based on on-chain KMS status
        const defaultImageName = onchainKmsEnabled ? DEFAULT_ONCHAIN_IMAGE : DEFAULT_IMAGE;
        selectedImage = selectedTeepod.images?.find(image => image.name === defaultImageName);
        if (!selectedImage) {
          logger.error(`Failed to find default image ${defaultImageName} for the selected TEEPod.`);
          process.exit(1);
        }
      }

      // Process allowed environment variables
      let allowedEnvs: string[] = [];
      if (options.allowedEnvs) {
        allowedEnvs = options.allowedEnvs.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      } else {
        const { envsStr } = await inquirer.prompt([
          {
            type: 'input',
            name: 'envsStr',
            message: 'Enter allowed environment variables (comma-separated), or leave blank if none:',
          },
        ]);
        if (envsStr) {
          allowedEnvs = envsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
      }

      // Prepare VM configuration
      const vmConfig = {
        teepod_id: selectedTeepod.teepod_id,
        name: options.name,
        image: selectedImage.name,
        vcpu: vcpu,
        memory: memory,
        disk_size: diskSize,
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

      if (options.useOnchainKms) {
        if (!teepods.kms_list || teepods.kms_list.length === 0) {
          logger.error('No KMS instances available for on-chain KMS.');
          process.exit(1);
        }

        const { selectedKmsId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedKmsId',
            message: 'Select a KMS instance to use:',
            choices: teepods.kms_list.map(kms => ({
              name: `${kms.url} (ID: ${kms.id})`,
              value: kms.id,
            })),
          },
        ]);

        // On-chain KMS: Call create endpoint and display details for next steps
        const createSpinner = logger.startSpinner('Creating CVM for on-chain KMS...');
        const response = await provisionCvm(vmConfig);
        createSpinner.stop(true);

        if (!response) {
          logger.error('Failed to create CVM for on-chain KMS');
          process.exit(1);
        }

        logger.success('CVM created for on-chain KMS successfully!');
        logger.info('Please use the following details for `kms deploy` and `cvms provision` commands.');
        logger.break();
        logger.keyValueTable({
          'App ID': response.app_id,
          'Device ID': response.device_id,
          'Compose Hash': response.compose_hash,
          'FMSPC': response.fmspc,
          'OS Image Hash': response.os_image_hash,
        });

      } else {
        // Traditional KMS: Full CVM creation
        // Get public key from CVM
        const spinner = logger.startSpinner('Getting public key from CVM');
        const pubkey = await getPubkeyFromCvm(vmConfig);
        spinner.stop(true);

        if (!pubkey) {
          logger.error('Failed to get public key from CVM');
          process.exit(1);
        }

        // Encrypt environment variables
        const encryptSpinner = logger.startSpinner('Encrypting environment variables');
        const encrypted_env = await encryptEnvVars(envs, pubkey.app_env_encrypt_pubkey);
        encryptSpinner.stop(true);

        if (options.debug) {
          logger.debug('Public key:', pubkey.app_env_encrypt_pubkey);
          logger.debug('Encrypted environment variables:', encrypted_env);
          logger.debug('Environment variables:', JSON.stringify(envs));
        }
        const createSpinner = logger.startSpinner('Provisioning CVM');
        const response = await createCvm({
          ...vmConfig,
          encrypted_env,
          app_env_encrypt_pubkey: pubkey.app_env_encrypt_pubkey,
          app_id_salt: pubkey.app_id_salt,
        });
        createSpinner.stop(true);

        if (!response) {
          logger.error('Failed to create CVM');
          process.exit(1);
        }

        logger.success('CVM created successfully');
        logger.break();
        const tableData = {
          'CVM ID': response.id,
          'App ID': response.app_id,
          'Name': response.name,
          'Status': response.status,
          'Endpoint': `https://app-${response.app_id}.phala.network`,
          'Created At': new Date(response.created_at).toLocaleString(),
        };

        if (response.kms_contract_address) {
          tableData['KMS Contract Address'] = response.kms_contract_address;
        }
        if (response.kms_owner_address) {
          tableData['KMS Owner Address'] = response.kms_owner_address;
        }

        logger.keyValueTable(tableData);
      }
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
