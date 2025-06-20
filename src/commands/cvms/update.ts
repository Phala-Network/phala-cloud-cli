import { Command } from 'commander';
import { getCvmByCvmId, getCvmComposeFile, updateCvmCompose, updatePatchCvmCompose } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import fs from 'node:fs';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { CLOUD_URL } from '@/src/utils/constants';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { getNetworkConfig } from '@/src/utils/blockchain';

async function gatherUpdateInputs(cvmId: string, options: any): Promise<any> {
  if (!cvmId) {
    const { id } = await inquirer.prompt([{ type: 'input', name: 'id', message: 'Enter the CVM ID to update:' }]);
    cvmId = id;
  }

  const spinner = logger.startSpinner(`Fetching current configuration for CVM ${cvmId}`);
  const currentCvm = await getCvmByCvmId(cvmId);
  spinner.stop(true);

  if (!currentCvm) {
    logger.error(`CVM with CVM ID ${cvmId} not found`);
    process.exit(1);
  }

  if (!options.compose) {
    const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
    const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
    options.compose = await promptForFile('Enter the path to your new Docker Compose file:', composeFileName, 'file');
  }

  let envs: EnvVar[] = [];
  let allowedEnvs: string[] = [];

  if (!options.skipEnv) {
    // If envFile is not provided, try to find one automatically
    let envFilePath = options.envFile;

    if (!envFilePath) {
      // Check for environment files in order of priority
      const envFiles = ['.env.production', '.env.prod', '.env'];
      for (const file of envFiles) {
        if (fs.existsSync(file)) {
          envFilePath = file;
          logger.info(`Using environment file: ${envFilePath}`);
          break;
        }
      }

      // If no env file found, ask user if they want to provide one
      if (!envFilePath) {
        envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
      }
    }

    if (envFilePath) {
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
        logger.error(`Error reading environment file ${envFilePath}:`, error);
      }
    }
  }


  return { ...options, cvmId, currentCvm, allowedEnvs };
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
  } else {
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

async function registerComposeHash(composeHash: string, appAuthAddress: string, wallet: ethers.Wallet): Promise<void> {
  const spinner = logger.startSpinner('Adding compose hash for on-chain KMS...');
  try {
    const appAuthAbi = ['function addComposeHash(bytes32 composeHash)', 'event ComposeHashAdded(bytes32 composeHash)'];
    const appAuthContract = new ethers.Contract(appAuthAddress, appAuthAbi, wallet);

    const formattedHash = composeHash.startsWith('0x') ? composeHash : `0x${composeHash}`;
    const tx = await appAuthContract.addComposeHash(formattedHash);
    const receipt = await tx.wait();

    spinner.stop(true);
    logger.success('Compose hash added successfully!');
    logger.info(`Transaction hash: ${tx.hash}`);

    const appAuthInterface = new ethers.Interface(appAuthAbi);
    const eventTopic = appAuthInterface.getEvent('ComposeHashAdded').topicHash;
    const log = receipt.logs.find((l: any) => l.topics[0] === eventTopic);

    if (log) {
      const parsedLog = appAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
      logger.info(`  - Compose Hash: ${parsedLog.args.composeHash}`);
    } else {
      logger.warn('Could not find ComposeHashAdded event to extract Compose Hash.');
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

async function applyUpdate(cvmId: string, composeHash: string, encryptedEnv: string): Promise<void> {
  const spinner = logger.startSpinner('Applying update...');
  try {
    const payload = { compose_hash: composeHash, encrypted_env: encryptedEnv };
    const response = await updatePatchCvmCompose(cvmId, payload);

    if (response === null) {
      spinner.stop(true);
      logger.success('Update applied successfully!');
    } else {
      spinner.stop(false);
      logger.error(`Failed to apply update: ${JSON.stringify(response.detail, null, 2)}`);
      process.exit(1);
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

export const updateCommand = new Command()
  .name('update')
  .description("Update a CVM's Docker Compose configuration for on-chain KMS.")
  .argument('[cvm-id]', 'CVM ID to update (will prompt for selection if not provided)')
  .option('--app-auth-contract-address <appAuthContractAddress>', 'AppAuth contract address for on-chain KMS')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to new environment file (optional)')
  .option('--skip-env', 'Skip environment variables', false)
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--rpc-url <rpcUrl>', 'RPC URL (overrides network default) for the blockchain.')
  .action(async (cvmId, options) => {
    try {
      const { cvmId: finalCvmId, currentCvm, ...gatheredOptions } = await gatherUpdateInputs(cvmId, options);
      let { wallet, rpcUrl } = await getNetworkConfig(gatheredOptions);

      if (!options.appAuthContractAddress) {
        const { addr } = await inquirer.prompt([{
          type: 'input',
          name: 'addr',
          message: 'Enter the AppAuth contract address to update:',
          validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
        }]);
        options.appAuthContractAddress = addr;
      }

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

      logger.success(`CVM update has been provisioned. New compose hash: ${response.compose_hash}`);
      logger.info(`Dashboard: ${CLOUD_URL}/dashboard/cvms/${currentCvm.vm_uuid}`);

      if (currentCvm.kms_info) {
        logger.info('This CVM uses on-chain KMS. Registering the new compose hash...');
        await registerComposeHash(response.compose_hash, options.appAuthContractAddress, wallet);
      }

      await applyUpdate(finalCvmId, response.compose_hash, encryptedEnv);

    } catch (error) {
      logger.error(`Failed to update CVM: ${error instanceof Error ? error.message : String(error)}`);
      if (options.debug && error.stack) {
        logger.error(error.stack);
      }
      process.exit(1);
    }
  });
