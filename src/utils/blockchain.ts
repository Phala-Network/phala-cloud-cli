import { ethers, Wallet } from 'ethers';
import path from 'node:path';
import inquirer from 'inquirer';
import { logger } from './logger';
import dotenv from 'dotenv';
import { defineChain, type Chain } from 'viem';
import { base, mainnet, sepolia, anvil } from 'viem/chains';
import { deployAppAuth } from '@phala/cloud';
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Helper to ensure a hex string has a '0x' prefix
export const ensureHexPrefix = (hex: string) => hex.startsWith('0x') ? hex : `0x${hex}`;

export interface NetworkConfig {
  wallet: Wallet;
  rpcUrl: string;
}

export interface AppAuthResult {
  appId: string;
  proxyAddress: string;
  deployerAddress: string;
}

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [base.id]: base,
  15107: defineChain({
    id: 15107,
    name: "T16Z",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ["https://rpc.t16z.com"],
      },
    },
  }),
  [anvil.id]: {
    ...anvil,
    rpcUrls: {
      default: {
        http: ["http://127.0.0.1:8545"],
      },
    },
  },
};
/**
 * Configures the blockchain network connection, including RPC URL and wallet.
 */
export function getChainConfig(chainId: number): Chain {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
}

export async function getNetworkConfig(options: any, chainId?: number, interactive?: boolean): Promise<NetworkConfig> {
  let { rpcUrl, privateKey } = options;

  if (!rpcUrl && chainId) {
    const chain = getChainConfig(chainId);
    rpcUrl = chain.rpcUrls.default.http[0];
  }
  if (!privateKey) {
    // Check for PRIVATE_KEY environment variable
    if (process.env.PRIVATE_KEY) {
      privateKey = process.env.PRIVATE_KEY;
      logger.debug('Using private key from PRIVATE_KEY environment variable');
    } else if (interactive) {
      const { key } = await inquirer.prompt([{
        type: 'password',
        name: 'key',
        message: 'Enter the private key for signing:',
        validate: (input) => !!input || 'Private key is required. You can also set the PRIVATE_KEY environment variable.',
      }]);
      privateKey = key;
    }
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(ensureHexPrefix(privateKey), provider);
  logger.success(`Connected to RPC at ${rpcUrl}. Using wallet ${wallet.address}`);
  return { wallet, rpcUrl };
}

async function gatherDeploymentInputs(options: any, wallet: Wallet): Promise<{ deployerAddress: string, initialDeviceId: string, composeHash: string }> {
  // In non-interactive mode, check for required parameters
  if (!options.interactive) {
    if (!options.initialDeviceId || !options.composeHash) {
      throw new Error(
        'Missing required parameters in non-interactive mode. ' +
        'Please provide --initial-device-id and --compose-hash parameters or use --interactive flag.'
      );
    }
    return {
      deployerAddress: wallet.address,
      initialDeviceId: options.initialDeviceId,
      composeHash: options.composeHash,
    };
  }

  // In interactive mode, prompt for missing parameters
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'initialDeviceId',
      message: 'Enter the initial device ID (32-byte hex, or leave empty for zero hash):',
      when: !options.initialDeviceId,
      default: ethers.ZeroHash,
      validate: (input) => 
        (input === '' || (input.length === 66 && input.startsWith('0x'))) || 
        'Please enter a valid 32-byte hex string starting with 0x or leave empty for zero hash.',
    },
    {
      type: 'input',
      name: 'composeHash',
      message: 'Enter the initial compose hash (32-byte hex, or leave empty for zero hash):',
      when: !options.composeHash,
      default: ethers.ZeroHash,
      validate: (input) => 
        (input === '' || (input.length === 66 && input.startsWith('0x'))) || 
        'Please enter a valid 32-byte hex string starting with 0x or leave empty for zero hash.',
    }
  ]);

  return {
    deployerAddress: wallet.address,
    initialDeviceId: options.initialDeviceId || answers.initialDeviceId || ethers.ZeroHash,
    composeHash: options.composeHash || answers.composeHash || ethers.ZeroHash,
  };
}

async function deployDefaultAppAuth(kmsContractAddress: string, deployerAddress: string, initialDeviceId: string, composeHash: string, wallet: Wallet, chainId: number, rpcUrl: string): Promise<AppAuthResult> {
  const spinner = logger.startSpinner(`Deploying DstackApp instance via DstackKms factory at ${kmsContractAddress}...`);
  
  try {
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
          http: [rpcUrl],
        },
      },
    });
    
    // Use type assertion based on the expected return structure
    const result = await deployAppAuth({
      chain: chain,
      kmsContractAddress: kmsContractAddress as `0x${string}`,
      privateKey: wallet.privateKey as `0x${string}`,
      deviceId: initialDeviceId as `0x${string}`, // This will automatically set allowAnyDevice to false
      composeHash: composeHash as `0x${string}`,
      minBalance: '0.01' // Minimum ETH balance required
    }) as {
      appId: string;
      appAuthAddress: string;
      transactionHash: string;
      deployer: string;
    };
    
    spinner.stop(true);
    
    logger.success('DstackApp instance deployed and registered successfully!');
    return { 
      appId: result.appId,
      proxyAddress: result.appAuthAddress,
      deployerAddress: result.deployer 
    };
  } catch (error) {
    spinner.stop(true);
    logger.error('Failed to deploy DstackApp instance:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function handleAppAuthDeployment(options: any, wallet: Wallet, kmsContractAddress: string, chainId: number, rpcUrl: string): Promise<AppAuthResult> {
  if (!options.kmsId) {
    throw new Error('KMS ID is required.');
  }

  if (!kmsContractAddress) {
    throw new Error('DstackKms Address is required.');
  }

  const params = await gatherDeploymentInputs(options, wallet);

  return await deployDefaultAppAuth(kmsContractAddress, params.deployerAddress, params.initialDeviceId, params.composeHash, wallet, chainId, rpcUrl);
}
