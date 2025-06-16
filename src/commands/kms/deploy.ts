import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const deployCommand = new Command()
  .name('deploy')
  .description('Deploy or register an AppAuth contract for on-chain KMS.')
  .option('--kms-contract-address <kmsContractAddress>', 'Address of the main KmsAuth contract.')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--network <network>', 'The network to deploy to (e.g., hardhat, phala, sepolia, test)')
  .option('--rpc-url <rpc-url>', 'RPC URL (overrides network default) for the blockchain.')
  .option('--app-auth-address <appAuthAddress>', 'Register a pre-deployed AppAuth contract at this address.')
  .option('--app-auth-contract-path <appAuthContractPath>', 'Path to a custom AppAuth contract file for deployment.')
  .option('--deployer-address <deployerAddress>', 'Address of the owner for the new AppAuth instance.')
  .option('--initial-device-id <initialDeviceId>', 'Initial device ID for the new AppAuth instance.')
  .option('--compose-hash <composeHash>', 'Initial compose hash for the new AppAuth instance.')
  .action(async (options) => {
    let {
      kmsContractAddress,
      privateKey,
      rpcUrl,
      appAuthAddress,
      appAuthContractPath,
      deployerAddress,
      initialDeviceId,
      composeHash,
      network,
    } = options;

    try {
      if (appAuthAddress && appAuthContractPath) {
        logger.error('Cannot use --app-auth-address and --app-auth-contract-path at the same time.');
        process.exit(1);
      }

      // Interactive flow if intent is not clear from flags
      if (!appAuthAddress && !appAuthContractPath) {
        const { hasDeployedContract } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'hasDeployedContract',
            message: 'Do you have a pre-deployed AppAuth contract to register?',
            default: false,
          },
        ]);

        if (hasDeployedContract) {
          const { addr } = await inquirer.prompt([
            {
              type: 'input',
              name: 'addr',
              message: 'Enter the address of your pre-deployed AppAuth contract:',
              validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
            },
          ]);
          appAuthAddress = addr;
        } else {
          const { useCustomContract } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'useCustomContract',
              message: 'Do you want to deploy using a custom AppAuth contract file?',
              default: false,
            },
          ]);
          if (useCustomContract) {
            const { p } = await inquirer.prompt([
              {
                type: 'input',
                name: 'p',
                message: 'Enter the path to your custom AppAuth contract file:',
                validate: (input) => {
                  if (!input) return 'Contract path is required.';
                  if (!fs.existsSync(input)) return 'The specified file does not exist.';
                  if (!fs.statSync(input).isFile()) return 'The specified path is not a file.';
                  return true;
                },
              },
            ]);
            appAuthContractPath = p;
          }
          // If not custom, appAuthContractPath remains empty, and we proceed to default deployment.
        }
      }

      if (!network && !rpcUrl) {
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'network',
            message: 'Select the network to deploy to:',
            choices: ['hardhat', 'phala', 'sepolia', 'test'],
            default: 'hardhat',
          },
        ]);
        network = answers.network;
      } else if (!network) {
        network = 'test'; // Default if rpcUrl is provided but network is not
      }

      if (!rpcUrl) {
        switch (network) {
          case 'phala':
            rpcUrl = 'https://rpc.phala.network';
            break;
          case 'sepolia':
            let alchemyApiKey = process.env.ALCHEMY_API_KEY;
            if (!alchemyApiKey) {
              const { apiKey } = await inquirer.prompt([
                {
                  type: 'password',
                  name: 'apiKey',
                  message: 'Enter your Alchemy API Key for Sepolia:',
                  mask: '*',
                  validate: (input) => input.length > 0 || 'API Key cannot be empty.',
                },
              ]);
              alchemyApiKey = apiKey;
            }
            rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
            break;
          case 'test':
            rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545/';
            break;
          case 'hardhat':
          default:
            rpcUrl = 'http://127.0.0.1:8545';
            break;
        }
      }

      const baseAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'kmsContractAddress',
          message: 'Enter the address of the main KmsAuth contract:',
          when: !kmsContractAddress,
          validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
        },
        {
          type: 'password',
          name: 'privateKey',
          message: 'Enter the private key for signing:',
          when: !privateKey,
          validate: (input) => input ? true : 'Private key is required.',
        },
      ]);

      kmsContractAddress = kmsContractAddress || baseAnswers.kmsContractAddress;
      privateKey = privateKey || baseAnswers.privateKey;
      const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(formattedPrivateKey, provider);
      logger.success(`Connected to RPC at ${rpcUrl}. Using wallet ${wallet.address}`);

      // WORKFLOW 1: Register a pre-deployed AppAuth contract
      if (appAuthAddress) {
        let spinner = logger.startSpinner(`Calling registerApp on KmsAuth contract (${kmsContractAddress})...`);
        try {
          const kmsAuthAbi = [
            "function registerApp(address app)",
            "event AppRegistered(address appId)"
          ];
          const kmsAuthContract = new ethers.Contract(kmsContractAddress, kmsAuthAbi, wallet);
          const nonce = await wallet.getNonce();
          const tx = await kmsAuthContract.registerApp(appAuthAddress, { nonce });
          const receipt = await tx.wait();
          spinner.stop(true);

          const kmsAuthInterface = new ethers.Interface(kmsAuthAbi);
          const eventTopic = kmsAuthInterface.getEvent('AppRegistered').topicHash;
          const log = receipt.logs.find(l => l.topics[0] === eventTopic);

          if (log) {
            const parsedLog = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
            const { appId } = parsedLog.args;
            logger.success('Custom AppAuth contract registered successfully!');
            logger.info(`  - App ID (Contract Address): ${appId}`);
            logger.info(`  - Transaction Hash: ${tx.hash}`);
          } else {
            logger.warn('Could not find AppRegistered event to confirm registration.');
            logger.success('Transaction was sent, but confirmation failed. Please check manually.');
            logger.info(`  - Transaction Hash: ${tx.hash}`);
          }
        } catch (error) {
          spinner.stop(true);
          throw error; // Rethrow to be caught by the main catch block
        }
        return;
      }

      // For deployment flows, we need deployment params
      const deployAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'deployerAddress',
          message: 'Enter the address of the deployer/owner for the new AppAuth instance:',
          when: !deployerAddress,
          validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
        },
        {
          type: 'input',
          name: 'initialDeviceId',
          message: 'Enter the initial device ID for the AppAuth contract (can be 0x0):',
          when: !initialDeviceId,
          default: '0x0000000000000000000000000000000000000000000000000000000000000000',
          validate: (input) => (input.length === 66 && input.startsWith('0x')) || 'Please enter a valid 32-byte hex string (0x...).',
        },
        {
          type: 'input',
          name: 'composeHash',
          message: 'Enter the initial compose hash for the AppAuth contract (can be 0x0):',
          when: !composeHash,
          default: '0x0000000000000000000000000000000000000000000000000000000000000000',
          validate: (input) => (input.length === 66 && input.startsWith('0x')) || 'Please enter a valid 32-byte hex string (0x...).',
        }
      ]);

      deployerAddress = deployerAddress || deployAnswers.deployerAddress;
      initialDeviceId = initialDeviceId || deployAnswers.initialDeviceId;
      composeHash = composeHash || deployAnswers.composeHash;

      // Ensure hex prefixes for bytes32 params, which is required by ethers.js
      if (initialDeviceId && /^[0-9a-fA-F]{64}$/.test(initialDeviceId)) {
        initialDeviceId = `0x${initialDeviceId}`;
      }
      if (composeHash && /^[0-9a-fA-F]{64}$/.test(composeHash)) {
        composeHash = `0x${composeHash}`;
      }

      // WORKFLOW 2: Deploy custom contract from path, then register
      if (appAuthContractPath) {
        let spinner;

        try {
          logger.info(`Using custom contract from: ${appAuthContractPath}`);
          if (!fs.existsSync(appAuthContractPath)) {
            throw new Error(`Custom contract file not found at: ${appAuthContractPath}`);
          }

          spinner = logger.startSpinner('Compiling custom contract with Hardhat...');
          execSync('npx hardhat compile', { stdio: 'pipe', cwd: process.cwd() });
          spinner.stop(true);
          logger.success('Contracts compiled successfully.');

          spinner = logger.startSpinner('Deploying custom AppAuth contract...');
          // To robustly find the artifact, we need the contract's path relative to the project root.
          const relativeContractPath = path.relative(process.cwd(), path.resolve(appAuthContractPath));
          const contractName = path.basename(relativeContractPath, '.sol');
          const appAuthArtifactPath = path.resolve(
            process.cwd(),
            'artifacts',
            relativeContractPath,
            `${contractName}.json`
          );
          if (!fs.existsSync(appAuthArtifactPath)) {
            throw new Error(`Could not find contract artifact at ${appAuthArtifactPath}.`);
          }
          const appAuthArtifact = await fs.readJson(appAuthArtifactPath);
          const appAuthFactory = new ethers.ContractFactory(appAuthArtifact.abi, appAuthArtifact.bytecode, wallet);
          const customAppAuth = await appAuthFactory.deploy();
          await customAppAuth.waitForDeployment();
          const customAppAuthAddress = await customAppAuth.getAddress();
          spinner.stop(true);
          logger.success(`Custom AppAuth contract deployed at: ${customAppAuthAddress}`);

          spinner = logger.startSpinner(`Registering custom AppAuth contract with KmsAuth...`);
          const kmsAuthAbi = [
            "function registerApp(address app)",
            "event AppRegistered(address appId)"
          ];
          const kmsAuthContract = new ethers.Contract(kmsContractAddress, kmsAuthAbi, wallet);
          const nonce = await wallet.getNonce();
          const registerTx = await kmsAuthContract.registerApp(customAppAuthAddress, { nonce });
          const receipt = await registerTx.wait();
          spinner.stop(true);
          logger.success('Custom AppAuth contract registered successfully!');
          logger.info(`Transaction hash: ${registerTx.hash}`);

          const kmsAuthInterface = new ethers.Interface(kmsAuthAbi);
          const eventTopic = kmsAuthInterface.getEvent('AppRegistered').topicHash;
          const log = receipt.logs.find(l => l.topics[0] === eventTopic);

          if (log) {
            const parsedLog = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
            const { appId } = parsedLog.args;
            logger.success('Custom AppAuth contract registered successfully!');
            logger.info(`  - App ID (Contract Address): ${appId}`);
            logger.info(`  - Transaction Hash: ${registerTx.hash}`);
          } else {
            logger.warn('Could not find AppRegistered event to confirm registration.');
            logger.success('Transaction was sent, but confirmation failed. Please check manually.');
            logger.info(`  - Transaction Hash: ${registerTx.hash}`);
          }

        } finally {
        }
      } else {
        // WORKFLOW 3: Deploy default contract via factory
        let spinner;

        logger.info('Using default AppAuth contract for deployment.');
        const kmsAuthAbi = [
          "function setAppAuthImplementation(address _implementation)",
          "function deployAndRegisterApp(address,bool,bool,bytes32,bytes32) returns (address, address)",
          "event AppDeployedViaFactory(address indexed appId, address indexed proxyAddress, address indexed deployer)"
        ];
        const kmsAuthContract = new ethers.Contract(kmsContractAddress, kmsAuthAbi, wallet);

        spinner = logger.startSpinner('Deploying final AppAuth instance via KmsAuth factory...');
        const deployTx = await kmsAuthContract.deployAndRegisterApp(
          deployerAddress,
          false, // disableUpgrades
          true,  // allowAnyDevice
          initialDeviceId,
          composeHash
        );
        const receipt = await deployTx.wait();
        spinner.stop(true);
        logger.success('AppAuth instance deployed and registered successfully!');
        logger.info(`Transaction hash: ${deployTx.hash}`);

        const kmsAuthInterface = new ethers.Interface(kmsAuthAbi);
        const eventTopic = kmsAuthInterface.getEvent('AppDeployedViaFactory').topicHash;
        const log = receipt.logs.find(l => l.topics[0] === eventTopic);

        if (log) {
          const parsedLog = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
          const { appId, proxyAddress } = parsedLog.args;
          logger.success('Deployment Details:');
          logger.info(`  - App ID: ${appId}`);
          logger.info(`  - Proxy Address: ${proxyAddress}`);
        } else {
          logger.warn('Could not find AppDeployedViaFactory event to extract App ID and Proxy Address.');
        }
      }
    } catch (error) {
      logger.error(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
      if (error.stack) {
        logger.error(error.stack);
      }
      process.exit(1);
    }
  });
