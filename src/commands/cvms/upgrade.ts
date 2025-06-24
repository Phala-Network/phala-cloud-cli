import { Command } from 'commander';
import { getCvmByAppId, getCvmComposeFile, updateCvmCompose, updatePatchCvmCompose } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import fs from 'node:fs';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { deleteSimulatorEndpointEnv } from '@/src/utils/simulator';
import { resolveCvmAppId } from '@/src/utils/cvms';
import { CLOUD_URL } from '@/src/utils/constants';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getNetworkConfig } from '@/src/utils/blockchain';

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
  const currentCvm = await getCvmByAppId(cvmId);
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
        if (options.interactive) {
          envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
        }
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

async function registerComposeHash(composeHash: string, appId: string, wallet: ethers.Wallet, kmsContractAddress: string, rpcUrl: string): Promise<void> {
  const spinner = logger.startSpinner('Adding compose hash for on-chain KMS...');
  let appAuthAddress: any;
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl)
    });

    // KMS Auth ABI for reading app registration details
    const kmsAuthAbi = [
      {
        inputs: [{ name: 'app', type: 'address' }],
        name: 'apps',
        outputs: [
          { name: 'isRegistered', type: 'bool' },
          { name: 'controller', type: 'address' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    try {
      // Ensure the KMS contract address is valid
      if (!ethers.isAddress(kmsContractAddress)) {
        throw new Error(`Invalid KMS contract address: ${kmsContractAddress}`);
      }

      if (!ethers.isAddress(appId)) {
        throw new Error(`Invalid custom App ID: ${appId}`);
      }

      // Ensure customAppId has 0x prefix
      const customAppId = appId.startsWith('0x')
        ? appId
        : `0x${appId}`;

      // Query the KMS contract for app registration details
      const [isRegistered, controllerAddress] = await publicClient.readContract({
        address: kmsContractAddress as `0x${string}`,
        abi: kmsAuthAbi,
        functionName: 'apps',
        args: [customAppId as `0x${string}`]
      });

      // Validate the response
      if (!isRegistered) {
        throw new Error(`App ${appId} is not registered in KMS contract ${kmsContractAddress}`);
      }

      if (!controllerAddress || controllerAddress === ethers.ZeroAddress) {
        throw new Error(`Invalid controller address for app ${appId}`);
      }

      logger.info(`Successfully verified AppAuth contract at ${controllerAddress}`);

      appAuthAddress = controllerAddress;
    } catch (error) {
      throw new Error(`Failed to verify custom App ID: ${error instanceof Error ? error.message : String(error)}`);
    }
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

export const upgradeCommand = new Command()
  .name('upgrade')
  .description('Upgrade a CVM to a new version')
  .argument('[app-id]', 'CVM app ID to upgrade')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--private-key <privateKey>', 'Private key for signing transactions')
  .option('--debug', 'Enable debug mode', false)
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .action(async (appId, options) => {
    try {

      const resolvedAppId = await resolveCvmAppId(appId);
      const { cvmId: finalCvmId, currentCvm, ...gatheredOptions } = await gatherUpdateInputs(resolvedAppId, options);

      const { composeString, encryptedEnv } = await prepareUpdatePayload(gatheredOptions, currentCvm);
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
      logger.info(`Dashboard: ${CLOUD_URL}/dashboard/cvms/${currentCvm.vm_uuid.replace(/-/g, '')}`);

      if (currentCvm.kms_info) {
        // Check for private key in options or environment variables
        const privateKey = options.privateKey || process.env.PRIVATE_KEY;
        if (!privateKey) {
          throw new Error('Private key is required for on-chain KMS operations. Please provide it via --private-key or PRIVATE_KEY environment variable');
        }
        
        const { wallet } = await getNetworkConfig({ privateKey, rpcUrl: options.rpcUrl });
        logger.info(`Using wallet: ${wallet.address}`);
        logger.info('This CVM uses on-chain KMS. Registering the new compose hash...');
        await registerComposeHash(response.compose_hash, appId, wallet, currentCvm.kms_info.kms_contract_address, options.rpcUrl);
      }

      await applyUpdate(finalCvmId, response.compose_hash, encryptedEnv);
    } catch (error) {
      logger.error(`Failed to upgrade CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 