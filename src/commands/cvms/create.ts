import { Command } from 'commander';
import { createCvm, getPubkeyFromCvm, encryptSecrets } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL } from '@/src/utils/constants';
import fs from 'fs';
import { Env } from '@/src/api/types';
import path from 'path';
import inquirer from 'inquirer';

export const createCommand = new Command()
  .name('create')
  .description('Create a new CVM')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', 'Number of vCPUs', String(DEFAULT_VCPU))
  .option('--memory <memory>', 'Memory in MB', String(DEFAULT_MEMORY))
  .option('--disk-size <diskSize>', 'Disk size in GB', String(DEFAULT_DISK_SIZE))
  .option('-e, --env <env...>', 'Environment variables in the form of KEY=VALUE')
  .option('--env-file <envFile>', 'Path to environment file')
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

      // Get examples directories
      const examplesDir = path.join(process.cwd(), 'examples');
      const examples = [];
      
      if (fs.existsSync(examplesDir)) {
        const exampleDirs = fs.readdirSync(examplesDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
          .map(dirent => dirent.name);
        
        examples.push(...exampleDirs);
      }
      
      // Validate and read the Docker Compose file
      let composeString = '';
      try {
        // If compose path not provided, prompt with examples
        if (!options.compose) {
          if (examples.length > 0) {
            // Prepare choices for the inquirer prompt
            const choices = [
              ...examples.map((example, index) => ({ 
                name: example, 
                value: { type: 'example', name: example } 
              })),
              new inquirer.Separator(),
              { name: 'Enter a file path', value: { type: 'custom' } }
            ];
            
            const { selection } = await inquirer.prompt([
              {
                type: 'list',
                name: 'selection',
                message: 'Choose a Docker Compose example or enter a custom path:',
                choices
              }
            ]);
            
            if (selection.type === 'example') {
              // User selected an example
              const exampleDir = path.join(examplesDir, selection.name);
              const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
              
              let foundCompose = false;
              for (const file of possibleFiles) {
                const composePath = path.join(exampleDir, file);
                if (fs.existsSync(composePath)) {
                  options.compose = composePath;
                  foundCompose = true;
                  logger.info(`Using example: ${selection.name} (${options.compose})`);
                  break;
                }
              }
              
              if (!foundCompose) {
                logger.error(`Could not find docker-compose.yml or docker-compose.yaml in ${exampleDir}`);
                process.exit(1);
              }
            } else {
              // User chose to enter a custom path
              const { customPath } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'customPath',
                  message: 'Enter the path to your Docker Compose file:',
                  validate: (input) => {
                    if (!input.trim()) {
                      return 'Docker Compose file path is required';
                    }
                    return true;
                  }
                }
              ]);
              
              options.compose = customPath;
            }
          } else {
            // No examples available, just ask for the path
            const { customPath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customPath',
                message: 'Enter the path to your Docker Compose file:',
                validate: (input) => {
                  if (!input.trim()) {
                    return 'Docker Compose file path is required';
                  }
                  return true;
                }
              }
            ]);
            
            options.compose = customPath;
          }
        }
        
        const composePath = path.resolve(options.compose);
        if (!fs.existsSync(composePath)) {
          logger.error(`Docker Compose file not found: ${composePath}`);
          process.exit(1);
        }
        composeString = fs.readFileSync(composePath, 'utf8');
      } catch (error) {
        logger.error(`Failed to read Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      
      // Process environment variables
      const envs: Env[] = [];
      
      // Process environment variables from command line
      if (options.env) {
        for (const env of options.env) {
          if (env.includes('=')) {
            const [key, value] = env.split('=');
            if (key && value) {
              envs.push({ key, value });
            }
          }
        }
      }
      
      // Process environment variables from file
      if (options.envFile) {
        try {
          const envFileContent = fs.readFileSync(options.envFile, 'utf8');
          for (const line of envFileContent.split('\n')) {
            if (line.includes('=')) {
              const [key, value] = line.split('=');
              if (key && value) {
                envs.push({ key: key.trim(), value: value.trim() });
              }
            }
          }
        } catch (error) {
          logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      }

      // Prompt for environment variables if none provided
      if (envs.length === 0) {
        const { shouldAddEnv } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldAddEnv',
            message: 'Do you want to add environment variables?',
            default: false
          }
        ]);
        
        if (shouldAddEnv) {
          logger.info('Enter environment variables in the form of KEY=VALUE');
          
          let addMore = true;
          while (addMore) {
            const { envKey, envValue } = await inquirer.prompt([
              {
                type: 'input',
                name: 'envKey',
                message: 'Environment variable key:',
                validate: (input) => {
                  if (!input.trim()) {
                    return 'Key is required';
                  }
                  return true;
                }
              },
              {
                type: 'input',
                name: 'envValue',
                message: 'Environment variable value:',
                validate: (input) => {
                  if (!input.trim()) {
                    return 'Value is required';
                  }
                  return true;
                }
              }
            ]);
            
            envs.push({ key: envKey.trim(), value: envValue.trim() });
            
            const { continueAdding } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'continueAdding',
                message: 'Add another environment variable?',
                default: false
              }
            ]);
            
            addMore = continueAdding;
          }
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
            name: `${pod.name} (${pod.status})`,
            value: pod.id
          }))
        }
      ]);
      
      // Find the selected TEEPod
      const selectedTeepod = teepods.find(pod => pod.id === selectedTeepodId);
      if (!selectedTeepod) {
        logger.error('Failed to find selected TEEPod');
        process.exit(1);
      }
      
      logger.info(`Selected TEEPod: ${selectedTeepod.name}`);
      
      // Prepare VM configuration
      const vmConfig = {
        teepod_id: selectedTeepod.id,
        name: options.name,
        image: 'dstack-dev-0.3.5', // TODO: Make this configurable
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
      const encrypted_env = await encryptSecrets(envs, pubkey.app_env_encrypt_pubkey);
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
      logger.info(`  tee-cloud-cli cvms status ${response.app_id}`);
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 