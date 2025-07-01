import { Command } from 'commander';
import { logger } from '@/src/utils/logger';
import { getNetworkConfig, handleAppAuthDeployment } from '@/src/utils/blockchain';
import inquirer from 'inquirer';
import { ethers } from 'ethers';

export const deployCommand = new Command()
  .name('deploy')
  .description('Deploy or register an AppAuth contract for on-chain KMS.')
  .option('--kms-contract-address <kmsContractAddress>', 'Address of the main KmsAuth contract.')
  .option('--private-key <privateKey>', 'Private key for signing transactions.')
  .option('--network <network>', 'The network to deploy to (e.g., hardhat, phala, sepolia, test)')
  .option('--rpc-url <rpcUrl>', 'RPC URL for the blockchain.')
  .option('--app-auth-address <appAuthAddress>', 'Register a pre-deployed AppAuth contract.')
  .option('--app-auth-contract-path <appAuthContractPath>', 'Path to a custom AppAuth contract file.')
  .option('--use-default-app-auth', 'Deploy the default AppAuth contract via factory.', false)
  .option('--deployer-address <deployerAddress>', 'Address of the owner for the new AppAuth instance.')
  .option('--initial-device-id <initialDeviceId>', 'Initial device ID for the new AppAuth instance.')
  .option('--compose-hash <composeHash>', 'Initial compose hash for the new AppAuth instance.')
  .action(async (options) => {
    try {
      const providedOptionsCount = [options.appAuthAddress, options.appAuthContractPath, options.useDefaultAppAuth].filter(Boolean).length;
      if (providedOptionsCount > 1) {
        throw new Error('Cannot use --app-auth-address, --app-auth-contract-path, and --use-default-app-auth at the same time.');
      }

      const { wallet, ...networkConfig } = await getNetworkConfig(options);
      const finalOptions = { ...options, ...networkConfig };

      if (!finalOptions.kmsContractAddress) {
        const { addr } = await inquirer.prompt([{
          type: 'input',
          name: 'addr',
          message: 'Enter the address of the main KmsAuth contract:',
          validate: (input) => ethers.isAddress(input) || 'Please enter a valid Ethereum address.',
        }]);
        finalOptions.kmsContractAddress = addr;
      }
      
      await handleAppAuthDeployment(finalOptions, wallet);

    } catch (error) {
      logger.error(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
      if (error.stack && process.env.DEBUG) {
        logger.error(error.stack);
      }
      process.exit(1);
    }
  });
