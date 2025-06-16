import { Command } from 'commander';
import { createCvmOnChainKms, provisionCvm } from '@/src/api/cvms';
import { getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import type { TEEPod } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_ONCHAIN_IMAGE } from '@/src/utils/constants';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { getKmsPubkey } from '@/src/api/kms';

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const onchainCreateCommand = new Command()
  .name('onchain-create')
  .description('Create a new CVM with on-chain KMS in one step.')
  // Create options
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory in MB, default is ${DEFAULT_MEMORY}`)
  .option('--disk-size <diskSize>', `Disk size in GB, default is ${DEFAULT_DISK_SIZE}`)
  .option('--teepod-id <teepodId>', 'TEEPod ID to use.')
  .option('--image <image>', 'Version of dstack image to use.')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--allowed-envs <allowedEnvs>', 'Allowed environment variables for the CVM.')
  // Deploy options
  .option('--kms-contract-address <kmsContractAddress>', 'Address of the main KmsAuth contract.')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--network <network>', 'The network to deploy to (e.g., hardhat, phala, sepolia, test)')
  .option('--rpc-url <rpc-url>', 'RPC URL for the blockchain.')
  .option('--deployer-address <deployerAddress>', 'Address of the owner for the new AppAuth instance.')
  .option('--app-auth-address <appAuthAddress>', 'Register a pre-deployed AppAuth contract at this address.')
  .option('--app-auth-contract-path <appAuthContractPath>', 'Path to a custom AppAuth contract file for deployment.')
  .option('--use-default-app-auth <useDefaultAppAuth>', 'Use the default AppAuth contract for deployment.', true)
  .action(async (options) => {
    try {
      // Step 1: Logic from `cvms create`
      logger.info('Step 1: Preparing CVM configuration...');

      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for the CVM:',
            validate: (input) => {
              if (!input.trim()) return 'CVM name is required';
              if (input.trim().length > 20) return 'CVM name must be less than 20 characters';
              if (input.trim().length < 3) return 'CVM name must be at least 3 characters';
              if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'CVM name must contain only letters, numbers, underscores, and hyphens';
              return true;
            }
          }
        ]);
        options.name = name;
      }

      if (!options.compose) {
        const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
        const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
        options.compose = await promptForFile('Enter the path to your Docker Compose file:', composeFileName, 'file');
      }

      const composePath = path.resolve(options.compose);
      if (!fs.existsSync(composePath)) {
        logger.error(`Docker Compose file not found: ${composePath}`);
        process.exit(1);
      }
      const composeString = fs.readFileSync(composePath, 'utf8');

      let envs: EnvVar[] = [];
      if (options.envFile) {
        try {
          envs = parseEnv([], options.envFile);
        } catch (error) {
          logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else if (!options.skipEnv) {
        const { shouldSkip } = await inquirer.prompt([{ type: 'confirm', name: 'shouldSkip', message: 'Do you want to skip environment variable prompt?', default: false }]);
        if (!shouldSkip) {
          const envVars = await promptForFile('Enter the path to your environment file:', '.env', 'file');
          envs = parseEnv([], envVars);
        }
      }

      const vcpu = Number(options.vcpu) || DEFAULT_VCPU;
      const memory = Number(options.memory) || DEFAULT_MEMORY;
      const diskSize = Number(options.diskSize) || DEFAULT_DISK_SIZE;

      const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
      const teepods = await getTeepods();
      teepodsSpinner.stop(true);
      if (teepods.nodes.length === 0) {
        logger.error('No TEEPods available.');
        process.exit(1);
      }

      const availableTeepods = teepods.nodes.filter(teepod => teepod.support_onchain_kms);
      if (availableTeepods.length === 0) {
        logger.error('No TEEPods available that support on-chain KMS.');
        process.exit(1);
      }

      let selectedTeepod: TEEPod;
      if (options.teepodId) {
        selectedTeepod = availableTeepods.find(pod => pod.teepod_id === Number(options.teepodId));
        if (!selectedTeepod) {
          logger.error(`Selected TEEPod with ID ${options.teepodId} is not available or does not support on-chain KMS.`);
          process.exit(1);
        }
      } else {
        const { teepod } = await inquirer.prompt([{ type: 'list', name: 'teepod', message: 'Select a TEEPod to use:', choices: availableTeepods.map(t => ({ name: `${t.name} (ID: ${t.teepod_id})`, value: t })) }]);
        selectedTeepod = teepod;
      }

      const defaultImageName = DEFAULT_ONCHAIN_IMAGE;
      const selectedImage = selectedTeepod.images?.find(image => image.name === defaultImageName);
      if (!selectedImage) {
        logger.error(`Failed to find default image ${defaultImageName} for the selected TEEPod.`);
        process.exit(1);
      }

      let allowedEnvs: string[] = [];
      if (options.allowedEnvs) {
        allowedEnvs = options.allowedEnvs.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      } else {
        const { envsStr } = await inquirer.prompt([{ type: 'input', name: 'envsStr', message: 'Enter allowed environment variables (comma-separated), or leave blank if none:' }]);
        if (envsStr) {
          allowedEnvs = envsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
      }

      const createVmConfig = {
        teepod_id: selectedTeepod.teepod_id,
        name: options.name,
        image: selectedImage.name,
        vcpu: vcpu,
        memory: memory,
        disk_size: diskSize,
        compose_file: {
          docker_compose_file: composeString,
          allowed_envs: allowedEnvs,
          features: ['kms', 'tproxy-net'],
          kms_enabled: true,
          manifest_version: 2,
          name: options.name,
          public_logs: true,
          public_sysinfo: true,
          tproxy_enabled: true,
        },
        listed: false,
      };

      const provisionSpinner = logger.startSpinner('Creating CVM for on-chain KMS...');
      const provisionResponse = await provisionCvm(createVmConfig);
      provisionSpinner.stop(true);

      if (!provisionResponse) {
        logger.error('Failed to prepare CVM for on-chain KMS');
        process.exit(1);
      }

      logger.success('CVM prepared for on-chain KMS successfully!');
      logger.keyValueTable({
        'Device ID': provisionResponse.device_id,
        'Compose Hash': provisionResponse.compose_hash,
        'OS Image Hash': provisionResponse.os_image_hash,
      });

      // Step 2: Logic from `kms deploy`
      logger.info('\nStep 2: Deploying AppAuth contract...');
      let { kmsContractAddress, privateKey, rpcUrl, deployerAddress, network, appAuthAddress, appAuthContractPath, useDefaultAppAuth } = options;
      let appId: string;
      let proxyAddress: string;

      // AppAuth contract deployment options are mutually exclusive
      const providedOptionsCount = [appAuthAddress, appAuthContractPath, useDefaultAppAuth].filter(Boolean).length;
      if (providedOptionsCount > 1) {
        logger.error('Cannot use --app-auth-address, --app-auth-contract-path, and --use-default-app-auth at the same time. Please provide only one.');
        process.exit(1);
      }

      // If no deployment option is provided via flags, prompt the user
      if (providedOptionsCount === 0) {
        const { deploymentType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'deploymentType',
            message: 'How would you like to handle the AppAuth contract?',
            choices: [
              { name: 'Deploy the default AppAuth contract (Recommended)', value: 'default' },
              { name: 'Register an existing, pre-deployed AppAuth contract', value: 'existing' },
              { name: 'Deploy a custom AppAuth contract from a local file', value: 'custom' },
            ],
            default: 'default',
          },
        ]);

        switch (deploymentType) {
          case 'default':
            // No action needed, the subsequent logic will handle this case.
            break;
          case 'existing':
            const { addr } = await inquirer.prompt([
              {
                type: 'input',
                name: 'addr',
                message: 'Enter the address of your pre-deployed AppAuth contract:',
                validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
              },
            ]);
            appAuthAddress = addr;
            break;
          case 'custom':
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
            break;
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
        network = 'test';
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

      if (appAuthAddress) {
        let spinner = logger.startSpinner(`Calling registerApp on KmsAuth contract (${kmsContractAddress})...`);
        try {
          const kmsAuthAbi = ["function registerApp(address app)", "event AppRegistered(address appId)"];
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
            appId = parsedLog.args.appId;
            proxyAddress = appAuthAddress; // For a pre-deployed contract, the proxy address is the one provided.
            logger.success('Custom AppAuth contract registered successfully!');
            logger.keyValueTable({
              'App ID (Contract Address)': appId,
              'Transaction Hash': tx.hash,
            });
          } else {
            logger.warn('Could not find AppRegistered event to confirm registration.');
            process.exit(1);
          }
        } catch (error) {
          spinner.stop(true);
          throw error;
        }
      } else {
        const deployAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'deployerAddress',
            message: 'Enter the address of the deployer/owner for the new AppAuth instance:',
            when: !deployerAddress,
            validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
          },
        ]);
        deployerAddress = deployerAddress || deployAnswers.deployerAddress;

        if (appAuthContractPath) {
          let spinner;
          try {
            logger.info(`Using custom contract from: ${appAuthContractPath}`);
            spinner = logger.startSpinner('Compiling custom contract with Hardhat...');
            execSync('npx hardhat compile', { stdio: 'pipe', cwd: process.cwd() });
            spinner.stop(true);
            logger.success('Contracts compiled successfully.');

            spinner = logger.startSpinner('Deploying custom AppAuth contract...');
            const relativeContractPath = path.relative(process.cwd(), path.resolve(appAuthContractPath));
            const contractName = path.basename(relativeContractPath, '.sol');
            const appAuthArtifactPath = path.resolve(process.cwd(), 'artifacts', relativeContractPath, `${contractName}.json`);
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
            const kmsAuthAbi = ["function registerApp(address app)", "event AppRegistered(address appId)"];
            const kmsAuthContract = new ethers.Contract(kmsContractAddress, kmsAuthAbi, wallet);
            const nonce = await wallet.getNonce();
            const registerTx = await kmsAuthContract.registerApp(customAppAuthAddress, { nonce });
            const receipt = await registerTx.wait();
            spinner.stop(true);

            const kmsAuthInterface = new ethers.Interface(kmsAuthAbi);
            const eventTopic = kmsAuthInterface.getEvent('AppRegistered').topicHash;
            const log = receipt.logs.find(l => l.topics[0] === eventTopic);

            if (log) {
              const parsedLog = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
              appId = parsedLog.args.appId;
              proxyAddress = customAppAuthAddress;
              logger.success('Custom AppAuth contract registered successfully!');
              logger.keyValueTable({
                'App ID (Contract Address)': appId,
                'Transaction Hash': registerTx.hash,
              });
            } else {
              logger.warn('Could not find AppRegistered event to confirm registration.');
              process.exit(1);
            }
          } finally { }
        } else {
          logger.info('Using default AppAuth contract for deployment.');
          const kmsAuthAbi = [
            "function deployAndRegisterApp(address,bool,bool,bytes32,bytes32) returns (address, address)",
            "event AppDeployedViaFactory(address indexed appId, address indexed proxyAddress, address indexed deployer)"
          ];
          const kmsAuthContract = new ethers.Contract(kmsContractAddress, kmsAuthAbi, wallet);

          const spinner = logger.startSpinner('Deploying final AppAuth instance via KmsAuth factory...');
          let deviceId = provisionResponse.device_id;
          if (!deviceId.startsWith('0x')) {
            deviceId = `0x${deviceId}`;
          }
          let composeHash = provisionResponse.compose_hash;
          if (!composeHash.startsWith('0x')) {
            composeHash = `0x${composeHash}`;
          }

          const deployTx = await kmsAuthContract.deployAndRegisterApp(
            deployerAddress,
            false, // disableUpgrades
            true,  // allowAnyDevice
            deviceId,
            composeHash
          );
          const receipt = await deployTx.wait();
          spinner.stop(true);

          const kmsAuthInterface = new ethers.Interface(kmsAuthAbi);
          const eventTopic = kmsAuthInterface.getEvent('AppDeployedViaFactory').topicHash;
          const log = receipt.logs.find(l => l.topics[0] === eventTopic);

          if (log) {
            const parsedLog = kmsAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
            appId = parsedLog.args.appId;
            proxyAddress = parsedLog.args.proxyAddress;
            logger.success('AppAuth instance deployed and registered successfully!');
            logger.keyValueTable({
              'App ID': appId,
              'Proxy Address': proxyAddress,
              'Transaction Hash': deployTx.hash,
            });
          } else {
            logger.warn('Could not find AppDeployedViaFactory event to extract App ID and Proxy Address.');
            process.exit(1);
          }
        }
      }

      // Step 3: Logic from `cvms provision`
      logger.info('\nStep 3: Encrypting environment variables...');
      let pubkey = '';
      if (proxyAddress) {
        const spinner = logger.startSpinner('Fetching public key from KMS...');
        const kmsResponse = await getKmsPubkey(teepods.kms_list[0].id, appId);
        pubkey = kmsResponse.public_key;
        spinner.stop(true);
      }

      let encrypted_env = '';
      if (envs.length > 0 && pubkey) {
        const encryptSpinner = logger.startSpinner('Encrypting environment variables');
        encrypted_env = await encryptEnvVars(envs, pubkey);
        encryptSpinner.stop(true);
      }

      logger.info('\nStep 4: Creating final CVM with on-chain KMS...');

      // Ensure all hex values have the '0x' prefix
      const finalAppId = appId.startsWith('0x') ? appId : `0x${appId}`;
      const finalProxyAddress = proxyAddress.startsWith('0x') ? proxyAddress : `0x${proxyAddress}`;
      const finalDeployerAddress = deployerAddress.startsWith('0x') ? deployerAddress : `0x${deployerAddress}`;

      const finalVmConfig = {
        app_id: finalAppId,
        compose_hash: provisionResponse.compose_hash,
        contract_address: finalProxyAddress,
        deployer_address: finalDeployerAddress,
        encrypted_env: encrypted_env,
        kms_id: teepods.kms_list[0].id,
      };

      const createSpinner = logger.startSpinner('Creating CVM...');
      logger.info(JSON.stringify(finalVmConfig));
      const finalResponse = await createCvmOnChainKms(finalVmConfig);
      createSpinner.stop(true);

      if (!finalResponse) {
        logger.error('Failed to create CVM');
        process.exit(1);
      }

      logger.success('CVM created successfully');
      logger.break();
      const tableData = {
        'CVM ID': finalResponse.vm_uuid,
        'Name': finalResponse.name,
        'Status': finalResponse.status,
        'App ID': finalResponse.app_id,
        'Endpoint': `${CLOUD_URL}/dashboard/cvms/${finalResponse.vm_uuid}`,
      };
      logger.keyValueTable(tableData);
    } catch (error) {
      logger.error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
