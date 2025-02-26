import { Command } from 'commander';
import { createCvm, getPubkeyFromCvm, encryptSecrets } from '../../api/cvms';
import { logger } from '../../utils/logger';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL } from '../../utils/constants';
import fs from 'fs';
import { Env } from '../../api/types';

export const createCommand = new Command()
  .name('create')
  .description('Create a new CVM')
  .requiredOption('-n, --name <name>', 'Name of the CVM')
  .requiredOption('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('-t, --type <type>', 'Type of CVM', 'phala')
  .option('-m, --mode <mode>', 'Mode of operation', 'docker-compose')
  .option('--vcpu <vcpu>', 'Number of vCPUs', String(DEFAULT_VCPU))
  .option('--memory <memory>', 'Memory in MB', String(DEFAULT_MEMORY))
  .option('--disk-size <diskSize>', 'Disk size in GB', String(DEFAULT_DISK_SIZE))
  .option('-e, --env <env...>', 'Environment variables in the form of KEY=VALUE')
  .option('--env-file <envFile>', 'Path to environment file')
  .option('--debug', 'Enable debug mode', false)
  .action(async (options) => {
    try {
      // Validate options
      if (options.type !== 'phala') {
        logger.error('Currently only phala is supported as the CVM type');
        process.exit(1);
      }
      
      if (options.mode !== 'docker-compose') {
        logger.error('Currently only docker-compose is supported as the mode');
        process.exit(1);
      }
      
      // Read the Docker Compose file
      let composeString = '';
      try {
        composeString = fs.readFileSync(options.compose, 'utf8');
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
      
      // Prepare VM configuration
      const vmConfig = {
        teepod_id: 2, // TODO: Get from /api/teepods
        name: options.name,
        image: 'dstack-dev-0.3.4', // TODO: Make this configurable
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
      logger.info(`App ID: ${response.app_id}`);
      logger.info(`App URL: ${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`);
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 