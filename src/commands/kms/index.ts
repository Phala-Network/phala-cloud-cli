import { Command } from 'commander';
import { deployCommand } from './deploy';

export const kmsCommand = new Command()
  .name('kms')
  .description('Manage On-Chain Key Management Service (KMS) components.')
  .addCommand(deployCommand);
