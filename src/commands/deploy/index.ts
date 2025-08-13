import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL } from "@/src/utils/constants";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { Command } from "commander";
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import { addComposeHash, createClient, encryptEnvVars, getCvmComposeFile, getCvmInfo, parseEnvVars, provisionCvmComposeFileUpdate, ProvisionCvmComposeFileUpdateRequest, safeAddComposeHash, safeCommitCvmComposeFileUpdate, safeCommitCvmProvision, safeDeployAppAuth, safeGetAppEnvEncryptPubKey, safeGetAvailableNodes, safeGetCvmComposeFile, safeGetCvmInfo, safeGetKmsList, safeProvisionCvm, safeProvisionCvmComposeFileUpdate, type EnvVar } from "@phala/cloud";
import { parseDiskSizeInput, parseMemoryInput } from "@/src/utils/units";
import { apiClient } from "@/src/api";
import { logger } from "@/src/utils/logger";
import { getCvmUuid, saveCvmUuid } from "@/src/utils/config";

interface Options {
  name?: string;
  compose?: string;
  vcpu?: string;
  memory?: string;
  diskSize?: string;
  image?: string;
  nodeId?: string;
  envFile?: string | boolean;
  kmsId?: string;
  uuid?: string;
  customAppId?: string;
  preLaunchScript?: string;
  privateKey?: string;
  rpcUrl?: string;
  apiKey?: string;
  [key: string]: any;
}

const validateBasic = async (options: Options): Promise<{ validatedOptions: Options, client: any }> => {
  // 1. Handle API Key
  let client = apiClient;
  if (!options.apiKey && !process.env.PHALA_CLOUD_API_KEY) {
    if (options.interactive) {
      const { apiKey } = await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        validate: (input: string) => input.trim() ? true : 'API key is required'
      }]);
      options.apiKey = apiKey;
      client = createClient({ apiKey: apiKey });
    } else {
      throw new Error(
        'API key is required. Please provide it via --api-key or PHALA_CLOUD_API_KEY environment variable'
      );
    }
  } else if (options.apiKey) {
    client = createClient({ apiKey: options.apiKey });
  }

  // 2. Handle compose file
  if (!options.compose) {
    if (options.interactive) {
      const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
      const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
      options.compose = await promptForFile('Enter the path to your Docker Compose file:', composeFileName, 'file');
    } else {
      throw new Error('Docker Compose file is required.\n\nUsage examples:\n  phala deploy --compose docker-compose.yml --node-id 1\n  phala deploy --compose docker-compose.yml --node-id 6 --kms-id t16z-dev --private-key <your-private-key> --rpc-url <rpc-url>\n\nMinimal required parameters:\n  --compose <path>    Path to docker-compose.yml\n\nFor on-chain KMS, also provide:\n  --kms-id <id>       KMS ID\n  --private-key <key> Private key for deployment\n  --rpc-url <url>     RPC URL for the blockchain\n\nRun with --interactive for guided setup');
    }
  }

  // 3. Check if compose file exists
  if (!fs.existsSync(options.compose)) {
    throw new Error(`Docker compose file not found: ${options.compose}`);
  }

  // 4. Handle UUID from environment
  const existingUuid = getCvmUuid();
  if (!options.uuid && existingUuid) {
    options.uuid = existingUuid;
  }

  return { validatedOptions: options, client };
};

const validatePrivateKey = async (options: Options, chainId: any) => {
  // 1. Handle Private Key from environment
  if (!options.privateKey && process.env.PRIVATE_KEY) {
    options.privateKey = process.env.PRIVATE_KEY;
  }

  // 2. Handle KMS related validations
  // TODO: rpc_url needs handling
  if (options.kmsId && chainId) {
    // If using on-chain KMS, either privateKey or customAppId must be provided
    if (!options.privateKey && !options.customAppId) {
      if (options.interactive) {
        const { authMethod } = await inquirer.prompt([{
          type: 'list',
          name: 'authMethod',
          message: 'Choose authentication method for on-chain KMS:',
          choices: [
            { name: 'Deploy with the standard DstackApp contract, you should provide --private-key', value: 'privateKey' },
            { name: 'Deploy with your own DstackApp contract, you should provide --custom-app-id', value: 'customAppId' }
          ]
        }]);

        if (authMethod === 'privateKey') {
          const { privateKey } = await inquirer.prompt([{
            type: 'password',
            name: 'privateKey',
            message: 'Enter your private key:',
            validate: (input: string) => input.trim() ? true : 'Private key is required'
          }]);
          options.privateKey = privateKey;
        } else {
          const { customAppId } = await inquirer.prompt([{
            type: 'input',
            name: 'customAppId',
            message: 'Enter your custom App ID:',
            validate: (input: string) => input.trim() ? true : 'Custom App ID is required'
          }]);
          options.customAppId = customAppId;
        }
      } else {
        throw new Error(
          'When using on-chain KMS, either --private-key (or PRIVATE_KEY env) or --custom-app-id must be provided'
        );
      }
    }
  }
}

const validateName = async (options: Options) => {
  if (!options.name) {
    let folderName = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    // Ensure folder name is at least 3 characters by appending 'cvm' if needed
    if (folderName.length < 3) {
      folderName = folderName + '-cvm';
    }
    const validFolderName = folderName.slice(0, 20); // Ensure max length of 20

    if (!options.interactive) {
      options.name = validFolderName;
    } else {
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for the CVM:',
          default: validFolderName,
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
  }
}

const validateEnvFile = async (options: Options) => {
  // Handle environment variables
  let envs: EnvVar[] = [];
  let envFilePath = options.envFile;

  // Handle environment file path resolution
  if (options.interactive && (!options.envFile || envFilePath === true)) {
    envFilePath = await promptForFile('Enter the path to your environment file:', '.env', 'file');
  }

  if (envFilePath && envFilePath !== true) {
    try {
      // Read and parse environment variables
      const envContent = fs.readFileSync(envFilePath, { encoding: 'utf8' });
      envs = parseEnvVars(envContent);
    } catch (error) {
      throw new Error(`Error reading environment file ${envFilePath}:`, error);
    }
  }
  return {
    envs
  }
}

const validateCpuMemoryDiskSize = async (options: Options) => {
  let vcpu = DEFAULT_VCPU;
  if (options.vcpu) {
    try {
      vcpu = Number(options.vcpu);
      console.log(`Using vCPUs: ${vcpu} (parsed from: ${options.vcpu})`);
    } catch (error) {
      throw new Error(`Invalid vCPU format '${options.vcpu}'. Using default: ${DEFAULT_VCPU}`);
    }
  }

  let memoryMB = DEFAULT_MEMORY;
  if (options.memory) {
    try {
      memoryMB = parseMemoryInput(options.memory);
      console.log(`Using memory: ${memoryMB}MB (parsed from: ${options.memory})`);
    } catch (error) {
      throw new Error(`Invalid memory format '${options.memory}'. Using default: ${DEFAULT_MEMORY}MB`);
    }
  }

  let diskSizeGB = DEFAULT_DISK_SIZE;
  if (options.diskSize) {
    try {
      diskSizeGB = parseDiskSizeInput(options.diskSize);
      console.log(`Using disk size: ${diskSizeGB}GB (parsed from: ${options.diskSize})`);
    } catch (error) {
      throw new Error(`Invalid disk size format '${options.diskSize}'. Using default: ${DEFAULT_DISK_SIZE}GB`);
    }
  }

  return {
    vcpu,
    memoryMB,
    diskSizeGB
  };
}

const validateNodeandKmsandImage = async (options: Options, client: any) => {
  const nodes_result = await safeGetAvailableNodes(client)
  if (!nodes_result.success) {
    if ("isRequestError" in nodes_result.error) {
      throw new Error(`HTTP ${nodes_result.error.status}: ${nodes_result.error.message}`)
    } else {
      throw new Error(`Validation error: ${nodes_result.error.issues}`)
    }
  }
  const nodes = nodes_result.data as any;
  let target = null;
  let kms = null;
  // If specified node, find it
  if (options.nodeId) {
    target = nodes.nodes.find((node) => node.teepod_id === Number(options.nodeId));
    if (!target) {
      throw new Error(`Node ${options.nodeId} not found, available nodes: ${nodes.nodes.map(t => t.teepod_id).join(', ')}`);
    }
  } else {
    // If interactive, let user select a node
    if (options.interactive) {
      const { node } = await inquirer.prompt([{
        type: 'list',
        name: 'node',
        message: 'Select a Node to use:',
        choices: nodes.nodes.map(t => ({
          name: `${t.name} (Region: ${t.region_identifier})`,
          value: t
        }))
      }]);
      target = node;
      options.nodeId = node.teepod_id;
    } else {
      // If no specified node, use the first one.
      target = nodes.nodes[0];
      options.nodeId = nodes.nodes[0].teepod_id;
    }
  }
  if (!target) {
    throw new Error(`No available nodes found, available nodes: ${nodes.nodes.map(t => t.teepod_id).join(', ')}`);
  }
  // If the target node supports on-chain kms, check if kms is specified
  if (target.support_onchain_kms) {
    const kms_result = await safeGetKmsList(client);
    if (!kms_result.success) {
      if ("isRequestError" in kms_result.error) {
        throw new Error(`HTTP ${kms_result.error.status}: ${kms_result.error.message}`)
      } else {
        throw new Error(`Validation error: ${kms_result.error.issues}`)
      }
    }
    const kms_list = kms_result.data as any;
    if (!options.kmsId) {
      if (options.interactive) {
        const { kmsChoice } = await inquirer.prompt([
          {
            type: 'list',
            name: 'kmsChoice',
            message: 'Select a KMS to use:',
            choices: kms_list.items.map(t => ({
              name: t.chain_id ?
                `${t.slug} (Chain ID: ${t.chain_id})` :
                `${t.slug} (No chain required)`,
              value: t
            }))
          }
        ]);
        kms = kmsChoice;
        options.kmsId = kmsChoice.slug;
      } else {
        throw new Error(`Node ${options.nodeId} requires a KMS ID for Contract Owned CVM, available kms: ${kms_list.items.map(t => t.slug).join(', ')}`);
      }
    } else {
      // Find the specified kms
      kms = kms_list.items.find((kms) => kms.slug === options.kmsId || kms.id === options.kmsId);
    }
    if (!kms) {
      throw new Error(`KMS ${options.kmsId} not found, available kms: ${kms_list.items.map(t => t.slug).join(', ')}`);
    } else {
      await validatePrivateKey(options, kms.chain_id);
    }
  }

  // Default image is the first one
  let image = target.images[0];
  if (options.image) {
    image = target.images.find((image) => image.name === options.image);
    if (!image) {
      throw new Error(`Image ${options.image} not found in the node ${target.name}, available images: ${target.images.map(t => t.name).join(', ')}.`);
    }
  } else {
    if (options.interactive) {
      const { imageChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'imageChoice',
          message: 'Select an image to use:',
          choices: target.images.map(t => ({
            name: `${t.name}`,
            value: t
          }))
        }
      ]);
      image = imageChoice;
    }
  }
  if (!image) {
    throw new Error(`No available OS images found in the node ${target.name}, available images: ${target.images.map(t => t.name).join(', ')}.`);
  }

  return {
    target,
    kms,
    image
  }
}


const deployNewCvm = async (validatedOptions: Options, docker_compose_yml: string, envs: EnvVar[], client: any) => {
  // await validateKMSId(validatedOptions);
  await validateName(validatedOptions);
  const { vcpu, memoryMB, diskSizeGB } = await validateCpuMemoryDiskSize(validatedOptions);
  const { target, kms, image } = await validateNodeandKmsandImage(validatedOptions, client);

  const app_compose = {
    name: validatedOptions.name,
    compose_file: {
      docker_compose_file: docker_compose_yml,
    },
    vcpu: vcpu,
    memory: memoryMB,
    disk_size: diskSizeGB,
    node_id: target.teepod_id,
    image: image.name,
    kms_id: kms?.slug,
  };

  // Deploy the app with Centralized KMS
  const provision_result = await safeProvisionCvm(client, app_compose);
  if (!provision_result.success) {
    throw new Error('Failed to provision CVM:', provision_result.error);
  }
  const app = provision_result.data as any;
  let commit_result;

  // For centralized KMS, we can get the AppID & AppEnvEncryptPubkey from provision response.
  if ((app.app_env_encrypt_pubkey && app.app_id) || !kms?.chain_id) {
    const encrypted_env_vars = await encryptEnvVars(envs, app.app_env_encrypt_pubkey);
    commit_result = await safeCommitCvmProvision(client, {
      app_id: app.app_id,
      encrypted_env: encrypted_env_vars,
      compose_hash: app.compose_hash,
    });
  } else {
    // For decentralized KMS, we need to deploy the app with on-chain KMS.
    const kms_slug = kms.slug;
    const kms_contract_address = kms.kms_contract_address;
    const chain = kms.chain;
    const privateKey = validatedOptions.privateKey;
    const compose_hash = app.compose_hash;
    const device_id = target.device_id;
    const rpc_url = validatedOptions.rpcUrl;

    const deploy_result = await safeDeployAppAuth({
      chain: chain,
      rpcUrl: rpc_url,
      kmsContractAddress: kms_contract_address,
      privateKey: privateKey as `0x${string}`,
      deviceId: device_id,
      composeHash: compose_hash,
    });
    if (!deploy_result.success) {
      throw new Error(`Deployment contract failed.`)
    }
    const deployed_contract = deploy_result.data as any;
    const app_id = deployed_contract.appId;
    const resp = await safeGetAppEnvEncryptPubKey(client, {
      app_id: app_id,
      kms: kms_slug,
    });
    if (!resp.success) {
      throw new Error(`Failed to get app env encrypt pubkey: ${resp.error.message}`)
    }
    const pubkey_signature = resp.data as any;
    const encrypted_env_vars = await encryptEnvVars(envs, pubkey_signature.public_key);
    commit_result = await safeCommitCvmProvision(client, {
      app_id: app_id,
      encrypted_env: encrypted_env_vars,
      compose_hash: app.compose_hash,
      kms_id: kms_slug,
      contract_address: deployed_contract.appAuthAddress,
      deployer_address: deployed_contract.deployer,
    });
  }

  if (!commit_result.success) {
    if ("isRequestError" in commit_result.error) {
      throw new Error(`HTTP ${commit_result.error.status}: ${commit_result.error.message}`)
    } else {
      throw new Error(`Validation error: ${commit_result.error.issues}`)
    }
  }
  const cvm = commit_result.data as any;
  const cvmUuid = cvm.vm_uuid.replace(/-/g, '');
  saveCvmUuid(cvmUuid);
  if (validatedOptions?.json !== false) {
    console.log(JSON.stringify({
      success: true,
      vm_uuid: cvmUuid,
      name: cvm.name,
      app_id: cvm.app_id,
      endpoint: `${CLOUD_URL}/dashboard/cvms/${cvmUuid}`,
    }, null, 2));
  } else {
    logger.success('CVM created successfully!');
    logger.break();
    logger.keyValueTable({
      'CVM ID': cvmUuid,
      'Name': cvm.name,
      'App ID': cvm.app_id,
      'Endpoint': `${CLOUD_URL}/dashboard/cvms/${cvmUuid}`,
    });
  }
}


const updateCvm = async (validatedOptions: Options, docker_compose_yml: string, envs: EnvVar[], client: any) => {
  const [cvm_result, app_compose_result] = await Promise.all([
    safeGetCvmInfo(client, {
      uuid: validatedOptions.uuid,
    }),
    safeGetCvmComposeFile(client, {
      uuid: validatedOptions.uuid,
    }),
  ]);
  if (!cvm_result.success) {
    throw new Error(`Failed to get cvm info: ${cvm_result.error.message}`);
  }
  if (!app_compose_result.success) {
    throw new Error(`Failed to get cvm compose file: ${app_compose_result.error.message}`);
  }
  const cvm = cvm_result.data as any;
  const app_compose = app_compose_result.data as any;

  // patched the compose_file
  app_compose.docker_compose_file = docker_compose_yml;
  app_compose.allowed_envs = envs.map((env) => env.key);

  const provision_result = await safeProvisionCvmComposeFileUpdate(client, {
    uuid: validatedOptions.uuid,
    app_compose: app_compose as ProvisionCvmComposeFileUpdateRequest["app_compose"],
  });
  if (!provision_result.success) {
    throw new Error(`Failed to provision cvm compose file: ${provision_result.error.message}`);
  }
  const provision = provision_result.data as any;

  let encrypted_env: string | undefined;
  if (cvm.kms_info?.chain_id) {
    // Update with decentralized KMS.
    console.log("Interacting with contract DstackApp");
    if (!validatedOptions.privateKey) {
      throw new Error("Private key is required for contract DstackApp");
    }

    const receipt_result = await safeAddComposeHash({
      chain: validatedOptions.chain,
      rpcUrl: validatedOptions.rpcUrl,
      appId: cvm.app_id as `0x${string}`,
      composeHash: provision.compose_hash,
      privateKey: validatedOptions.privateKey as `0x${string}`,
    });
    if (!receipt_result.success) {
      throw new Error(`Failed to add compose hash.`);
    }
    const receipt = receipt_result.data as any;
    console.log("the receipt: ", receipt);
  } else {
    if (envs.length > 0) {
      const encrypted_env_vars = await encryptEnvVars(envs, cvm.encrypted_env_pubkey!);
      encrypted_env = encrypted_env_vars;
    }
  }

  const commitResult = await safeCommitCvmComposeFileUpdate(client, {
    // @ts-ignore
    id: validatedOptions.uuid,
    compose_hash: provision.compose_hash,
    encrypted_env: encrypted_env,
    env_keys: envs.map((env) => env.key),
  });
  
  if (!commitResult.success) {
    throw new Error(`Failed to commit CVM compose file update: ${commitResult.error.message}`);
  }
  if (validatedOptions?.json !== false) {
    console.log(JSON.stringify({
      success: true,
      vm_uuid: validatedOptions.uuid,
      name: cvm.name,
      app_id: cvm.app_id,
      endpoint: `${CLOUD_URL}/dashboard/cvms/${validatedOptions.uuid}`,
    }, null, 2));
  } else {
    console.log("CVM compose file updated successfully!");
  }
}

export const deployCommand = new Command()
  .command('deploy [compose]')
  .description('Create a new CVM with on-chain KMS in one step.')
  .option('--json', 'Output in JSON format', true)
  .option('--no-json', 'Disable JSON output format')
  .option('--debug', 'Enable debug logging', false)
  .option('--api-key <apiKey>', 'API key for authentication')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file (default: docker-compose.yml in current directory)')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory with optional unit (e.g., 2G, 1024MB), default is ${DEFAULT_MEMORY}MB`)
  .option('--disk-size <diskSize>', `Disk size with optional unit (e.g., 50G, 100GB), default is ${DEFAULT_DISK_SIZE}GB`)
  .option('--image <image>', 'Version of dstack image to use')
  .option('--node-id <nodeId>', 'Node ID to use')
  .option('-e, --env-file <envFile>', 'Prompt for environment variables and save to file (optional)')
  .option('-i, --interactive', 'Enable interactive mode for required parameters', false)
  .option('--kms-id <kmsId>', 'KMS ID to use.')
  .option('--uuid <uuid>', 'UUID of the CVM to upgrade')
  .option('--custom-app-id <customAppId>', 'Custom App ID to use.')
  .option('--pre-launch-script <preLaunchScript>', 'Path to pre-launch script')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .action(async (composeFile: string | undefined, options: {
    name?: string;
    compose?: string;
    vcpu?: string;
    memory?: string;
    diskSize?: string;
    image?: string;
    nodeId?: string;
    envFile?: string | boolean;
    interactive?: boolean;
    kmsId?: string;
    uuid?: string;
    customAppId?: string;
    preLaunchScript?: string;
    privateKey?: string;
    rpcUrl?: string;
    json?: boolean;
    debug?: boolean;
    apiKey?: string;
  }) => {
    try {
      // Use positional argument if provided, otherwise use the --compose option
      if (composeFile) {
        options.compose = composeFile;
      }
      const { validatedOptions, client } = await validateBasic(options);
      const { envs } = await validateEnvFile(validatedOptions);
      const docker_compose_yml = fs.readFileSync(validatedOptions.compose, "utf8");

      const isUpdate = !!validatedOptions.uuid;
      if (isUpdate) {
        // Update the cvm
        await updateCvm(validatedOptions, docker_compose_yml, envs, client);
      } else {
        // Deploy a new cvm
        await deployNewCvm(validatedOptions, docker_compose_yml, envs, client);
      }
    } catch (error) {
      if (options.json !== false) {
        console.error(JSON.stringify({
          success: false,
          error: error.message,
          stack: options.debug && error instanceof Error ? error.stack : undefined
        }, null, 2));
      } else {
        console.error(error.message);
      }
      process.exit(1);
    }
  });