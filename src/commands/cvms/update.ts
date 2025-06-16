import { Command } from 'commander';
import { getCvmByCvmId, getCvmComposeFile, updateCvmCompose, updatePatchCvmCompose } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';
import { CLOUD_URL } from '@/src/utils/constants';
import inquirer from 'inquirer';
import { ethers } from 'ethers';

export const updateCommand = new Command()
  .name('update')
  .description("Update a CVM's Docker Compose configuration for on-chain KMS.")
  .argument('[cvm-id]', 'CVM ID to update (will prompt for selection if not provided)')
  .option('--app-auth-contract-address <appAuthContractAddress>', 'AppAuth contract address for on-chain KMS')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to new environment file (optional)')
  .option('--allowed-envs <allowedEnvs>', 'Allowed environment variables')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--rpc-url <rpcUrl>', 'RPC URL (overrides network default) for the blockchain.')
  .action(async (cvmId, options) => {
    let {
      privateKey,
      rpcUrl,
      appAuthContractAddress,
    } = options;
    try {
      const spinner = logger.startSpinner(`Fetching current configuration for CVM ${cvmId}`);
      const currentCvm = await getCvmByCvmId(cvmId);
      spinner.stop(true);
      const baseAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'privateKey',
          message: 'Enter the private key for signing:',
          when: !privateKey,
          validate: (input) => input ? true : 'Private key is required.',
        },
      ]);
      privateKey = privateKey || baseAnswers.privateKey;
      const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(formattedPrivateKey, provider);

      if (!currentCvm) {
        logger.error(`CVM with CVM ID ${cvmId} not found`);
        process.exit(1);
      }

      if (!options.compose) {
        const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
        const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
        options.compose = await promptForFile(
          'Enter the path to your new Docker Compose file:',
          composeFileName,
          'file'
        );
      }

      // Process allowed environment variables
      let allowedEnvs: string[] = [];
      if (options.allowedEnvs) {
        allowedEnvs = options.allowedEnvs.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      } else {
        const { envsStr } = await inquirer.prompt([
          {
            type: 'input',
            name: 'envsStr',
            message: 'Enter allowed environment variables (comma-separated), or leave blank if none:',
          },
        ]);
        if (envsStr) {
          allowedEnvs = envsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
      }

      const composeString = fs.readFileSync(options.compose, 'utf8');

      let encrypted_env = "";
      let envs: EnvVar[] = [];
      if (options.envFile) {
        try {
          envs = parseEnv([], options.envFile);
        } catch (error) {
          logger.error(`Failed to process environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else {
        const envVars = await promptForFile(
          'Enter the path to your environment file:',
          '.env',
          'file',
        );
        envs = parseEnv([], envVars);
      }

      if (!currentCvm.encrypted_env_pubkey) {
        logger.error('Could not find public key to encrypt environment variables for this CVM.');
        process.exit(1);
      }
      encrypted_env = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);

      if (currentCvm.kms_info) {
        logger.warn('This CVM appears to use on-chain KMS.');
        logger.warn('You must register the new compose hash with the AppAuth contract on-chain.');
      }

      // This is direct method by offchain client calculating compose_hash and encrypted_env
      // TODO:WIP
      // const updatePayload = {
      //   compose_file: {
      //     docker_compose_file: composeString,
      //     allowed_envs: allowedEnvs,
      //     features: currentCvm.compose_file.features || ['kms', 'tproxy-net'],
      //     kms_enabled: currentCvm.compose_file.kms_enabled || true,
      //     manifest_version: 2,
      //     name: currentCvm.name,
      //     public_logs: currentCvm.compose_file.public_logs || true,
      //     public_sysinfo: currentCvm.compose_file.public_sysinfo || true,
      //     tproxy_enabled: currentCvm.compose_file.tproxy_enabled || true,
      //   },
      //   compose_hash: composeHash,
      //   encrypted_env: encrypted_env,
      // };
      
      const currentComposeFile = await getCvmComposeFile(cvmId);
      currentComposeFile.docker_compose_file = composeString;
      currentComposeFile.allowed_envs = allowedEnvs;

      const updateSpinner = logger.startSpinner(`Updating CVM ${cvmId}`);
      const response = await updateCvmCompose(cvmId, currentComposeFile);
      updateSpinner.stop(true);
      let newComposeHash = response.compose_hash;

      if (response) {
        logger.success(`CVM update has been provisioned. You need to register the compose hash ${newComposeHash} for on-chain KMS.`);
        logger.info(`Dashboard: ${CLOUD_URL}/dashboard/cvms/${currentCvm.vm_uuid}`);
      } else {
        logger.error('Failed to initiate CVM update.');
        process.exit(1);
      }

      // Add compose hash for on-chain KMS
      let addComposeHashSpinner: { stop: any; };

      const appAuthAbi = [
        "function addComposeHash(bytes32 composeHash)",
        "event ComposeHashAdded(bytes32 composeHash)",
      ];
      const appAuthContract = new ethers.Contract(appAuthContractAddress, appAuthAbi, wallet);

      addComposeHashSpinner = logger.startSpinner('Adding compose hash for on-chain KMS...');
      if (newComposeHash && /^[0-9a-fA-F]{64}$/.test(newComposeHash)) {
        newComposeHash = `0x${newComposeHash}`;
      }
      const nonce = await wallet.getNonce();
      const deployTx = await appAuthContract.addComposeHash(newComposeHash, { nonce });
      const receipt = await deployTx.wait();
      addComposeHashSpinner.stop(true);
      logger.success('Compose hash added successfully!');
      logger.info(`Transaction hash: ${deployTx.hash}`);

      const appAuthInterface = new ethers.Interface(appAuthAbi);
      const eventTopic = appAuthInterface.getEvent('ComposeHashAdded').topicHash;
      const log = receipt.logs.find((l: { topics: string[]; }) => l.topics[0] === eventTopic);

      if (log) {
        const parsedLog = appAuthInterface.parseLog({ topics: Array.from(log.topics), data: log.data });
        const { composeHash } = parsedLog.args;
        logger.success('Compose hash added successfully!');
        logger.info(`  - Compose Hash: ${composeHash}`);
      } else {
        logger.warn('Could not find ComposeHashAdded event to extract Compose Hash.');
      }

      const updatePatchSpinner = logger.startSpinner('Applying update...');
      const updatePatchPayload = {
        compose_hash: response.compose_hash,
        encrypted_env: encrypted_env,
      };
      logger.info(JSON.stringify(updatePatchPayload));
      const updatePatchResponse = await updatePatchCvmCompose(cvmId, updatePatchPayload);
      updatePatchSpinner.stop(true);

      if (updatePatchResponse === null) {
        logger.success('Update applied successfully!');
      } else {
        logger.error(`Failed to apply update: ${JSON.stringify(updatePatchResponse.detail, null, 2)}`);
        process.exit(1);
      }


    } catch (error) {
      logger.error(`Failed to update CVM: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
