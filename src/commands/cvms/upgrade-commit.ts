import { Command } from 'commander';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { updatePatchCvmCompose, getCvmByCvmId } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { promptForFile } from '@/src/utils/prompts';
import { CLOUD_URL } from '@/src/utils/constants';

async function applyUpdate(cvmId: string, composeHash: string, encryptedEnv: string, options: any = {}): Promise<{ cvmId: string; message: string; dashboardUrl: string }> {
  const spinner = logger.startSpinner('Applying update...');
  try {
    const payload = { compose_hash: composeHash, encrypted_env: encryptedEnv };
    const response = await updatePatchCvmCompose(cvmId, payload);

    if (response === null) {
      spinner.stop(true);
      const result = {
        cvmId: cvmId.replace(/-/g, ''),
        message: 'Update applied successfully',
        dashboardUrl: `${CLOUD_URL}/dashboard/cvms/${cvmId.replace(/-/g, '')}`
      };
      
      if (options && options.json !== false) {
        console.log(JSON.stringify({
          success: true,
          cvm_id: result.cvmId,
          message: result.message,
          dashboard_url: result.dashboardUrl
        }, null, 2));
      } else {
        logger.success(result.message);
        logger.info(`Dashboard: ${result.dashboardUrl}`);
      }
      
      return result;
    } else {
      spinner.stop(false);
      const errorMessage = `Failed to apply update: ${JSON.stringify(response.detail, null, 2)}`;
      if (options && options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: errorMessage
        }, null, 2));
      } else {
        logger.error(errorMessage);
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

async function prepareUpdatePayload(options: any, currentCvm: any): Promise<{ encryptedEnv: string }> {

  let encryptedEnv = '';
  let envs: EnvVar[] = [];
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
      envs = parseEnv([], envFilePath);
      if (envs.length > 0) {
        logger.info(`Using environment variables from ${envFilePath}`);
      } else {
        logger.warn(`No environment variables found in ${envFilePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to process environment file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (envs.length > 0) {
    if (!currentCvm.encrypted_env_pubkey) {
      throw new Error('Could not find public key to encrypt environment variables for this CVM.');
    }
    encryptedEnv = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);
  }

  return { encryptedEnv };
}

export const upgradeCommitCommand = new Command()
  .name('upgrade-commit')
  .description('Commit a provisioned CVM upgrade')
  .argument('<cvm-id>', 'ID of the CVM to upgrade')
  .argument('<compose-hash>', 'Compose hash from the provision step')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--json', 'Output in JSON format (default: true)', true)
  .option('--no-json', 'Disable JSON output format')
  .action(async function(this: Command, cvmId: string, composeHash: string, options) {
    try {
      const spinner = logger.startSpinner(`Fetching current configuration for CVM ${cvmId}`);
      const currentCvm = await getCvmByCvmId(cvmId);
      spinner.stop(true);

      if (!currentCvm) {
        const errorMessage = `CVM ${cvmId} not found`;
        setCommandError(this, new Error(errorMessage));
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      const { encryptedEnv } = await prepareUpdatePayload(options, currentCvm);
      const result = await applyUpdate(currentCvm.vm_uuid.replace(/-/g, ''), composeHash, encryptedEnv, options);
      
      // Set command result for telemetry
      setCommandResult(this, {
        success: true,
        cvmId: result.cvmId,
        composeHash,
        dashboardUrl: result.dashboardUrl,
        timestamp: new Date().toISOString()
      });
      
      return;
    } catch (error) {
      const errorMessage = `Failed to commit CVM upgrade: ${error instanceof Error ? error.message : String(error)}`;
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
        logger.error(errorMessage);
      }
      
      // Don't call process.exit() as it prevents telemetry from being sent
      throw error;
    }
  });
