import { Command } from 'commander';
import { createCvm, getPubkeyFromCvm } from '@/src/api/cvms';
import { getTeepodImages, getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_TEEPOD_ID, DEFAULT_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { promptForFile } from '@/src/utils/prompts';

export const createCommand = new Command()
  .name('create')
  .description('Create a new CVM')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', 'Number of vCPUs', String(DEFAULT_VCPU))
  .option('--memory <memory>', 'Memory in MB', String(DEFAULT_MEMORY))
  .option('--disk-size <diskSize>', 'Disk size in GB', String(DEFAULT_DISK_SIZE))
  .option('--teepod-id <teepodId>', 'TEEPod ID to use', DEFAULT_TEEPOD_ID)
  .option('--image <image>', 'Version of dstack image to use', DEFAULT_IMAGE)
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--debug', 'Enable debug mode', false)
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
        const shouldSkip = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldSkip',
            message: 'Do you want to skip environment variable prompt?',
            default: false
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

      // Prompt for resource configuration if needed
      const resourceQuestions = [];

      if (options.vcpu === String(DEFAULT_VCPU)) {
        resourceQuestions.push({
          type: 'input',
          name: 'vcpu',
          message: `Enter number of vCPUs (default: ${DEFAULT_VCPU}):`,
          default: String(DEFAULT_VCPU),
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive number';
            }
            return true;
          }
        });
      }

      if (options.memory === String(DEFAULT_MEMORY)) {
        resourceQuestions.push({
          type: 'input',
          name: 'memory',
          message: `Enter memory in MB (default: ${DEFAULT_MEMORY}):`,
          default: String(DEFAULT_MEMORY),
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive number';
            }
            return true;
          }
        });
      }

      if (options.diskSize === String(DEFAULT_DISK_SIZE)) {
        resourceQuestions.push({
          type: 'input',
          name: 'diskSize',
          message: `Enter disk size in GB (default: ${DEFAULT_DISK_SIZE}):`,
          default: String(DEFAULT_DISK_SIZE),
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive number';
            }
            return true;
          }
        });
      }

      if (resourceQuestions.length > 0) {
        const resources = await inquirer.prompt(resourceQuestions);

        if (resources.vcpu) {
          options.vcpu = resources.vcpu;
        }

        if (resources.memory) {
          options.memory = resources.memory;
        }

        if (resources.diskSize) {
          options.diskSize = resources.diskSize;
        }
      }

      // Fetch available TEEPods
      if (!options.teepodId) {
        const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
        const teepods = await getTeepods();
        teepodsSpinner.stop(true);

        if (teepods.length === 0) {
          logger.error('No TEEPods available. Please try again later.');
          process.exit(1);
        }

        // Use inquirer to select a TEEPod
        const { selectedTeepodId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTeepodId',
            message: 'Select a TEEPod:',
            choices: teepods.map(pod => ({
              name: `${pod.name}`,
              value: pod.teepod_id
            }))
          }
        ]);

        // Find the selected TEEPod
        const selectedTeepod = teepods.find(pod => pod.teepod_id === selectedTeepodId);
        if (!selectedTeepod) {
          logger.error('Failed to find selected TEEPod');
          process.exit(1);
        }

        logger.info(`Selected TEEPod: ${selectedTeepod.name}`);
        options.teepodId = selectedTeepod.teepod_id;
      }

      if (!options.image) {
        const images = await getTeepodImages(options.teepodId);
        const imageChoices = images.map(image => ({
          name: `${image.name}`,
          value: image.name
        }));

        const { selectedImage } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedImage',
            message: 'Select an image:',
            choices: imageChoices
          }
        ]);
        options.image = selectedImage.value;
      }

      // Prepare VM configuration
      const vmConfig = {
        teepod_id: options.teepodId || 3,
        name: options.name,
        image: options.image || 'dstack-dev-0.3.5',
        vcpu: parseInt(options.vcpu),
        memory: parseInt(options.memory),
        disk_size: parseInt(options.diskSize),
        compose_manifest: {
          docker_compose_file: composeString,
          docker_config: {
            url: '',
            username: '',
            password: '',
          },
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

      // Create the CVM
      const createSpinner = logger.startSpinner('Creating CVM');
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
      logger.info(`CVM ID: ${response.id}`);
      logger.info(`Name: ${response.name}`);
      logger.info(`Status: ${response.status}`);
      logger.info(`App ID: ${response.app_id}`);

      if (response.app_url) {
        logger.info(`App URL: ${response.app_url}`);
      } else {
        logger.info(`App URL: ${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`);
      }

      logger.info('');
      logger.info('Your CVM is being created. You can check its status with:');
      logger.info(`phala cvms get ${response.app_id}`);
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 