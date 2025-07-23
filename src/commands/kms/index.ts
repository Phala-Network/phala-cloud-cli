import { Command } from 'commander';
import { listCommand } from './list';
import { infoCommand } from './info';

export const kmsCommands = new Command()
  .name('kms')
  .description('Key Management Service commands')
  .addCommand(listCommand)
  .addCommand(infoCommand);