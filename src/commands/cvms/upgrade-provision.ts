import { Command } from 'commander';
import { getCvmByCvmId, updateCvmCompose, getCvmComposeFile } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { parseEnv } from '@/src/utils/secrets';
import { promptForFile } from '@/src/utils/prompts';
import { CLOUD_URL } from '@/src/utils/constants';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { detectFileInCurrentDir } from '@/src/utils/prompts';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';


async function gatherUpdateInputs(cvmId: string, options: any): Promise<any> {
  if (!cvmId) {
    if (!options.interactive) {
      logger.error('CVM ID is required. Use --app-id to enter it');
      process.exit(1);
    } else {
      const { id } = await inquirer.prompt([{ type: 'input', name: 'id', message: 'Enter the CVM ID to update:' }]);
      cvmId = id;
    }
  }

  const spinner = logger.startSpinner(`Fetching current configuration for CVM ${cvmId}`);
  const currentCvm = await getCvmByCvmId(cvmId);
  spinner.stop(true);

  if (!currentCvm) {
    logger.error(`CVM with CVM ID ${cvmId} not found`);
    process.exit(1);
  }

  if (!options.compose) {
    if (!options.interactive) {
      logger.error('Docker Compose file is required. Use --compose to select it');
      process.exit(1);
    } else {
      const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
      const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
      options.compose = await promptForFile('Enter the path to your new Docker Compose file:', composeFileName, 'file');
    }
  }

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

  return { ...options, cvmId: currentCvm.vm_uuid.replace(/-/g, ''), currentCvm, allowedEnvs };
}

async function prepareUpdatePayload(options: any, currentCvm: any): Promise<{ composeString: string; encryptedEnv: string }> {
  const composeString = fs.readFileSync(options.compose, 'utf8');

  let encryptedEnv = '';
  let envs: EnvVar[] = [];
  if (options.envFile) {
    try {
      envs = parseEnv([], options.envFile);
    } catch (error) {
      logger.error(`Failed to process environment file: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  } else if (options.interactive) {
    const { useEnvFile } = await inquirer.prompt([{
      type: 'confirm',
      name: 'useEnvFile',
      message: 'Do you want to use an environment file?',
      default: false,
    }]);
    if (useEnvFile) {
      const envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
      envs = parseEnv([], envFilePath);
    }
  }

  if (envs.length > 0) {
    if (!currentCvm.encrypted_env_pubkey) {
      logger.error('Could not find public key to encrypt environment variables for this CVM.');
      process.exit(1);
    }
    encryptedEnv = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);
  }

  return { composeString, encryptedEnv };
}

export const upgradeProvisionCommand = new Command()
  .name('upgrade-provision')
  .description('Provision a CVM upgrade with a new compose file')
  .argument('<cvm-id>', 'ID of the CVM to upgrade')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--debug', 'Enable debug logging', false)
  .option('-i, --interactive', 'Enable interactive mode', false)
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .action(async (cvmId: string, options) => {
    try {
      const { cvmId: finalCvmId, currentCvm, ...gatheredOptions } = await gatherUpdateInputs(cvmId, options);
      const { composeString, encryptedEnv } = await prepareUpdatePayload(gatheredOptions, currentCvm);

      const spinner = logger.startSpinner(`Updating CVM ${finalCvmId}`);
      const currentComposeFile = await getCvmComposeFile(finalCvmId);
      currentComposeFile.docker_compose_file = composeString;
      currentComposeFile.allowed_envs = gatheredOptions.allowedEnvs;
      const response = await updateCvmCompose(finalCvmId, currentComposeFile);
      spinner.stop(true);

      if (!response || !response.compose_hash) {
        logger.error('Failed to initiate CVM update or get compose hash.');
        process.exit(1);
      }

      logger.info(`CVM UUID: ${currentCvm.vm_uuid.replace(/-/g, '')}`);
      logger.info(`App ID: ${currentCvm.app_id}`);

      if (options.json !== false) {
        console.log(JSON.stringify({
          success: true,
          data: {
            cvm_id: currentCvm.vm_uuid.replace(/-/g, ''),
            app_id: response.app_id,
            compose_hash: response.compose_hash,
            dashboard_url: `${CLOUD_URL}/dashboard/cvms/${currentCvm.vm_uuid.replace(/-/g, '')}`,
            raw: response
          }
        }, null, 2));
      } else {
        logger.success(`CVM update has been provisioned. New compose hash: ${response.compose_hash}`);
        logger.info(`Dashboard: ${CLOUD_URL}/dashboard/cvms/${currentCvm.vm_uuid.replace(/-/g, '')}`);
      }

    } catch (error) {
      const errorMessage = `Failed to provision CVM upgrade: ${error instanceof Error ? error.message : String(error)}`;
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
