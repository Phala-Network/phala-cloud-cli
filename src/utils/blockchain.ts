import { ethers, Wallet } from 'ethers';
import path from 'node:path';
import inquirer from 'inquirer';
import { logger } from './logger';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import { defineChain, type Chain } from 'viem';
import { base, mainnet, sepolia, anvil } from 'viem/chains';
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

const KMS_AUTH_ABI = [
  'function registerApp(address app)',
  'event AppRegistered(address appId)',
  'function setAppAuthImplementation(address _implementation)',
  'function deployAndRegisterApp(address,bool,bool,bytes32,bytes32) returns (address, address)',
  'event AppDeployedViaFactory(address indexed appId, address indexed proxyAddress, address indexed deployer)',
];

async function determineAction(options: any): Promise<{ action: 'register' | 'deployCustom' | 'deployDefault', appAuthAddress?: string, appAuthContractPath?: string }> {
  if (options.appAuthAddress) {
    return { action: 'register', appAuthAddress: options.appAuthAddress };
  }
  if (options.appAuthContractPath) {
    return { action: 'deployCustom', appAuthContractPath: options.appAuthContractPath };
  }
  if (options.useDefaultAppAuth) {
    return { action: 'deployDefault' };
  }

  // Interactive prompt if no flags are provided
  const { actionType } = await inquirer.prompt([{
    type: 'list',
    name: 'actionType',
    message: 'What would you like to do?',
    choices: [
      { name: 'Register a pre-deployed AppAuth contract', value: 'register' },
      { name: 'Deploy a new AppAuth contract from a custom file', value: 'deployCustom' },
      { name: 'Deploy the default AppAuth contract via factory', value: 'deployDefault' },
    ],
  }]);

  if (actionType === 'register') {
    const { addr } = await inquirer.prompt([{
      type: 'input',
      name: 'addr',
      message: 'Enter the address of your pre-deployed AppAuth contract:',
      validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
    }]);
    return { action: 'register', appAuthAddress: addr };
  }

  if (actionType === 'deployCustom') {
    const { p } = await inquirer.prompt([{
      type: 'input',
      name: 'p',
      message: 'Enter the path to your custom AppAuth contract file:',
      validate: (input) => fs.existsSync(input) && fs.statSync(input).isFile() || 'Please enter a valid file path.',
    }]);
    return { action: 'deployCustom', appAuthContractPath: p };
  }

  return { action: 'deployDefault' };
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

async function registerAppAuth(kmsContractAddress: string, appAuthAddress: string, wallet: Wallet): Promise<AppAuthResult> {
  const spinner = logger.startSpinner(`Registering AppAuth contract ${appAuthAddress}...`);
  const kmsAuthContract = new ethers.Contract(kmsContractAddress, KMS_AUTH_ABI, wallet);
  const tx = await kmsAuthContract.registerApp(appAuthAddress, { nonce: await wallet.getNonce() });
  const receipt = await tx.wait();
  spinner.stop(true);

  const kmsAuthInterface = new ethers.Interface(KMS_AUTH_ABI);
  const log = receipt.logs.find(l => l.topics[0] === kmsAuthInterface.getEvent('AppRegistered').topicHash);

  if (log) {
    const { appId } = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data }).args;
    logger.success('AppAuth contract registered successfully!');
    logger.keyValueTable({ 'App ID (Contract Address)': appId, 'Transaction Hash': tx.hash });
    return { appId, proxyAddress: appAuthAddress, deployerAddress: wallet.address };
  } else {
    logger.warn('Could not find AppRegistered event to confirm registration.');
    throw new Error('Registration failed: Event not found.');
  }
}

async function deployCustomAppAuth(kmsContractAddress: string, contractPath: string, deployerAddress: string, initialDeviceId: string, composeHash: string, wallet: Wallet): Promise<AppAuthResult> {
  logger.info(`Using custom contract from: ${contractPath}`);
  let spinner = logger.startSpinner('Compiling custom contract with Hardhat...');
  execSync('npx hardhat compile', { stdio: 'pipe' });
  spinner.stop(true);

  spinner = logger.startSpinner('Deploying custom AppAuth contract...');
  const relativePath = path.relative(process.cwd(), path.resolve(contractPath));
  const contractName = path.basename(relativePath, '.sol');
  const artifactPath = path.resolve(process.cwd(), 'artifacts', relativePath, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) throw new Error(`Could not find artifact at ${artifactPath}`);
  
  const artifact = await fs.readJson(artifactPath);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(); // Assumes no constructor args for custom contract
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  spinner.stop(true);
  logger.success(`Custom AppAuth contract deployed at: ${contractAddress}`);

  return await registerAppAuth(kmsContractAddress, contractAddress, wallet);
}

async function deployDefaultAppAuth(kmsContractAddress: string, deployerAddress: string, initialDeviceId: string, composeHash: string, wallet: Wallet): Promise<AppAuthResult> {
  const spinner = logger.startSpinner(`Deploying AppAuth instance via KmsAuth factory at ${kmsContractAddress}...`);
  const kmsAuthContract = new ethers.Contract(kmsContractAddress, KMS_AUTH_ABI, wallet);
  const tx = await kmsAuthContract.deployAndRegisterApp(deployerAddress, false, true, ensureHexPrefix(initialDeviceId), ensureHexPrefix(composeHash));
  const receipt = await tx.wait();
  spinner.stop(true);

  const kmsAuthInterface = new ethers.Interface(KMS_AUTH_ABI);
  const log = receipt.logs.find(l => l.topics[0] === kmsAuthInterface.getEvent('AppDeployedViaFactory').topicHash);

  if (log) {
    const { appId, proxyAddress } = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data }).args;
    logger.success('AppAuth instance deployed and registered successfully!');
    logger.keyValueTable({ 'App ID': appId, 'Proxy Address': proxyAddress, 'Transaction Hash': tx.hash });
    return { appId, proxyAddress, deployerAddress };
  } else {
    logger.warn('Could not find AppDeployedViaFactory event to extract details.');
    throw new Error('Deployment failed: Event not found.');
  }
}

export async function handleAppAuthDeployment(options: any, wallet: Wallet, kmsContractAddress: string): Promise<AppAuthResult> {
  // const { action, appAuthAddress, appAuthContractPath } = await determineAction(options);

  if (!options.kmsId) {
    throw new Error('KMS ID is required.');
  }

  if (!kmsContractAddress) {
    throw new Error('KMS Contract Address is required.');
  }

  // if (action === 'register') {
  //   if (!appAuthAddress) throw new Error('AppAuth address is required for registration.');
  //   return await registerAppAuth(options.kmsContractAddress, appAuthAddress, wallet);
  // }

  const params = await gatherDeploymentInputs(options, wallet);

  // if (action === 'deployCustom') {
  //   if (!appAuthContractPath) throw new Error('AppAuth contract path is required for custom deployment.');
  //   return await deployCustomAppAuth(options.kmsContractAddress, appAuthContractPath, params.deployerAddress, params.initialDeviceId, params.composeHash, wallet);
  // }

  return await deployDefaultAppAuth(kmsContractAddress, params.deployerAddress, params.initialDeviceId, params.composeHash, wallet);
}
