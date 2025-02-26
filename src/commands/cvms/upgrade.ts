import { Command } from 'commander';
import { upgradeCvm, getCvmByAppId, getPubkeyFromCvm, encryptSecrets } from '../../api/cvms';
import { logger } from '../../utils/logger';
import fs from 'fs';
import { Env } from '../../api/types';

export const upgradeCommand = new Command()
  .name('upgrade')
  .description('Upgrade a CVM to a new version')
  .argument('<app-id>', 'App ID of the CVM to upgrade')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env <env...>', 'Environment variables to add/update in the form of KEY=VALUE')
  .option('--env-file <envFile>', 'Path to environment file')
  .option('--debug', 'Enable debug mode', false)
  .action(async (appId, options) => {
    try {
      // Get current CVM configuration
      const spinner = logger.startSpinner(`Fetching current configuration for CVM ${appId}`);
      const currentCvm = await getCvmByAppId(appId);
      spinner.stop(true);
      
      if (!currentCvm) {
        logger.error(`CVM with App ID ${appId} not found`);
        process.exit(1);
      }
      
      // Prepare upgrade payload
      const upgradePayload: any = {};
      
      // Update Docker Compose file if provided
      if (options.compose) {
        let composeString = '';
        try {
          composeString = fs.readFileSync(options.compose, 'utf8');
        } catch (error) {
          logger.error(`Failed to read Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
        
        upgradePayload.compose_manifest = {
          ...currentCvm.compose_manifest,
          docker_compose_file: composeString,
        };
      }
      
      // Process environment variables if provided
      if (options.env || options.envFile) {
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
        
        if (envs.length > 0) {
          // Get public key from CVM
          const keySpinner = logger.startSpinner('Getting public key from CVM');
          const pubkey = await getPubkeyFromCvm({
            teepod_id: currentCvm.teepod_id,
            name: currentCvm.name,
            image: currentCvm.image,
            vcpu: currentCvm.vcpu,
            memory: currentCvm.memory,
            disk_size: currentCvm.disk_size,
            compose_manifest: currentCvm.compose_manifest,
            listed: currentCvm.listed,
          });
          keySpinner.stop(true);
          
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
          
          upgradePayload.encrypted_env = encrypted_env;
          upgradePayload.app_env_encrypt_pubkey = pubkey.app_env_encrypt_pubkey;
          upgradePayload.app_id_salt = pubkey.app_id_salt;
        }
      }
      
      // Check if there are any updates to apply
      if (Object.keys(upgradePayload).length === 0) {
        logger.warn('No upgrades specified. Please provide at least one parameter to upgrade.');
        process.exit(0);
      }
      
      // Upgrade the CVM
      const upgradeSpinner = logger.startSpinner(`Upgrading CVM ${appId}`);
      const response = await upgradeCvm(appId, upgradePayload);
      upgradeSpinner.stop(true);
      
      if (!response) {
        logger.error('Failed to upgrade CVM');
        process.exit(1);
      }
      
      logger.success(`CVM ${appId} upgraded successfully`);
      if (response.detail) {
        logger.info(`Details: ${response.detail}`);
      }
    } catch (error) {
      logger.error(`Failed to upgrade CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 