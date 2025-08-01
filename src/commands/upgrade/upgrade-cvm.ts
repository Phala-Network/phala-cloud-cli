import { getCvmByCvmId, getCvmComposeFile, updateCvmCompose, updatePatchCvmCompose } from '../../api/cvms';
import { logger } from '../../utils/logger';
import { parseEnv } from '../../utils/secrets';
import { deleteSimulatorEndpointEnv } from '../../utils/simulator';
import { detectFileInCurrentDir, promptForFile } from '../../utils/prompts';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { ethers } from 'ethers';
import { getChainConfig, getNetworkConfig } from '../../utils/blockchain';
import { addComposeHash } from '@phala/cloud';
import { defineChain } from 'viem';
import fs from 'node:fs';
import inquirer from 'inquirer';

export async function upgradeCvm(appId: string, options: any) {
  try {
    const { cvmId: finalCvmId, currentCvm, ...gatheredOptions } = await gatherUpdateInputs(appId, options);
    const { composeString, encryptedEnv } = await prepareUpdatePayload(gatheredOptions, currentCvm);
    
    await deleteSimulatorEndpointEnv();
    
    if (options.json === false) {
      if (process.env.DSTACK_DOCKER_USERNAME && process.env.DSTACK_DOCKER_PASSWORD) {
        logger.info("🔐 Using private DockerHub registry credentials...");
      } else if (process.env.DSTACK_AWS_ACCESS_KEY_ID && process.env.DSTACK_AWS_SECRET_ACCESS_KEY && process.env.DSTACK_AWS_REGION && process.env.DSTACK_AWS_ECR_REGISTRY) {
        logger.info(`🔐 Using private AWS ECR registry: ${process.env.DSTACK_AWS_ECR_REGISTRY}`);
      } else {
        logger.info("🔐 Using public DockerHub registry...");
      }
    }

    const spinner = logger.startSpinner(`Update-provisioning CVM: ${finalCvmId}`);
    const currentComposeFile = await getCvmComposeFile(finalCvmId);
    currentComposeFile.docker_compose_file = composeString;
    currentComposeFile.allowed_envs = gatheredOptions.allowedEnvs;
    const response = await updateCvmCompose(finalCvmId, currentComposeFile);
    spinner.stop(true);

    if (!response || !response.compose_hash) {
      throw new Error('Failed to initiate CVM update or get compose hash.');
    }

    let kmsResult;
    if (currentCvm.kms_info) {
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Private key is required for on-chain KMS operations. Please provide it via --private-key or PRIVATE_KEY environment variable');
      }
      
      // Get the chain config and determine the RPC URL with proper fallback
      const chain = getChainConfig(currentCvm.kms_info.chain_id);
      const rpcUrl = options.rpcUrl || currentCvm.kms_info.url || chain.rpcUrls.default.http[0];
      
      const { wallet } = await getNetworkConfig({ privateKey, rpcUrl }, currentCvm.kms_info.chain_id);
      
      kmsResult = await registerComposeHash(
        response.compose_hash, 
        response.app_id, 
        wallet, 
        currentCvm.kms_info.kms_contract_address, 
        rpcUrl, 
        currentCvm.kms_info.chain_id,
        { json: options.json }
      );
    }

    await applyUpdate(finalCvmId, response.compose_hash, encryptedEnv, { json: options.json });
    
    // Combine results
    return {
      success: true,
      cvmId: finalCvmId,
      composeHash: response.compose_hash,
      appId: response.app_id,
      message: 'CVM upgrade initiated successfully',
      kmsTransactionHash: kmsResult?.transactionHash,
      timestamp: new Date().toISOString()
    } as const;
  } catch (error) {
    logger.error(`Upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function gatherUpdateInputs(cvmId: string, options: any): Promise<any> {
  if (!cvmId) {
    if (!options.interactive) {
      throw new Error('CVM ID is required. Use --app-id to enter it');
    } else {
      const { id } = await inquirer.prompt([{ type: 'input', name: 'id', message: 'Enter the CVM ID to update:' }]);
      cvmId = id;
    }
  }

  const spinner = logger.startSpinner(`Fetching current configuration for CVM ${cvmId}`);
  const currentCvm = await getCvmByCvmId(cvmId);
  spinner.stop(true);

  if (!currentCvm) {
    throw new Error(`CVM with CVM ID ${cvmId} not found`);
  }

  if (!options.compose) {
    if (!options.interactive) {
      throw new Error('Docker Compose file is required. Use --compose to select it');
    } else {
      const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
      const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
      options.compose = await promptForFile('Enter the path to your new Docker Compose file:', composeFileName, 'file');
    }
  }

  let envs: EnvVar[] = [];
  let allowedEnvs: string[] = [];
  let envFilePath = options.envFile;

  if (options.interactive && (!options.envFile || envFilePath === true)) {
    envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
  } else if (!options.envFile || envFilePath === true) {
    logger.info('Environment file not specified. Skipping environment variables.');
  }

  if (envFilePath && envFilePath !== true) {
    try {
      envs = parseEnv([], envFilePath);
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
      throw new Error(`Failed to process environment file: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error('Could not find public key to encrypt environment variables for this CVM.');
    }
    encryptedEnv = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);
  }

  return { composeString, encryptedEnv };
}

async function applyUpdate(
  cvmId: string,
  composeHash: string,
  encryptedEnv: string,
  options: { json?: boolean } = {}
): Promise<{ success: boolean; message: string; composeHash: string }> {
  const spinner = logger.startSpinner('Applying update...');
  try {
    const payload = { compose_hash: composeHash, encrypted_env: encryptedEnv };
    const response = await updatePatchCvmCompose(cvmId, payload);
    spinner.stop(true);

    if (response === null) {
      const message = 'CVM update applied successfully';
      // Null response indicates success
      if (options.json !== false) {
        console.log(JSON.stringify({
          message: `${message} with new compose hash: ${composeHash}`
        }, null, 2));
      } else {
        logger.success(`${message}!`);
        logger.info(`Compose hash: ${composeHash}`);
      }
      return { success: true, message, composeHash };
    }
    
    // If we get here, there was an unexpected response
    throw new Error('Failed to apply update: ' + JSON.stringify(response));
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

async function registerComposeHash(
  composeHash: string,
  appId: string,
  wallet: ethers.Wallet,
  kmsContractAddress: string,
  rawRpcUrl: string,
  chainId: number,
  options: { json?: boolean } = {}
): Promise<{ success: boolean; transactionHash?: string; composeHash: string }> {
  const spinner = logger.startSpinner('Adding compose hash for on-chain KMS...');
  
  try {
    // Create a custom chain configuration with the provided RPC URL
    const chain = defineChain({
      id: chainId,
      name: `Custom Chain ${chainId}`,
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [rawRpcUrl],
        },
      },
    });

    const result = await addComposeHash({
      chain: chain,
      appId: appId as `0x${string}`,
      privateKey: wallet.privateKey as `0x${string}`,
      composeHash: composeHash,
      minBalance: '0.01', // Minimum ETH balance required
      // kmsContractAddress: kmsContractAddress as `0x${string}`,
    }) as {
      transactionHash: string;
      composeHash: string;
    };

    spinner.stop(true);
    
    return {
      success: true,
      transactionHash: result.transactionHash,
      composeHash: result.composeHash
    };
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}
