import { Command } from 'commander';
import { upgradeCvm, getCvmByAppId, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import fs from 'fs';
import { promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

export const upgradeCommand = new Command()
  .name('upgrade')
  .description('Upgrade a CVM to a new version')
  .argument('[app-id]', 'CVM app ID to upgrade (will prompt for selection if not provided)')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--debug', 'Enable debug mode', false)
  .action(async (appId, options) => {
    try {
      // If no app ID is provided, prompt user to select one
      if (!appId) {
        logger.info('No CVM specified, fetching available CVMs...');
        const selectedCvm = await selectCvm();
        if (!selectedCvm) {
          return;
        }
        appId = selectedCvm;
      }

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

      // If compose path not provided, prompt with examples
      if (!options.compose) {
          options.compose = await promptForFile(
            'Enter the path to your Docker Compose file:',
            'docker-compose.yml',
            'file'
        );
      }
      
      // Update Docker Compose file if provided
      let composeString = '';
      if (options.compose) {
        try {
          composeString = fs.readFileSync(options.compose, 'utf8');
        } catch (error) {
          logger.error(`Failed to read Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      }
      
      // Process environment variables if provided
      let encrypted_env = "";
      if (options.envFile) {
        let envs: EnvVar[] = [];
        
        // Process environment variables from file
        if (options.envFile) {
          try {
            envs = parseEnv([], options.envFile);
            encrypted_env = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);
          } catch (error) {
            logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }
        
      }

      const vm_config = {
        compose_manifest: {
          docker_compose_file: composeString,
          manifest_version: 1,
          runner: "docker-compose",
          version: "1.0.0",
          features: ["kms", "tproxy-net"],
          name: `app_${options.appId}`,
        },
        encrypted_env,
        allow_restart: true,
      };
      
      // Upgrade the CVM
      const upgradeSpinner = logger.startSpinner(`Upgrading CVM ${appId}`);
      const response = await upgradeCvm(appId, vm_config);
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