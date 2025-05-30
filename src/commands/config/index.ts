import { Command } from 'commander';
import { getCommand } from './get';
import { setCommand } from './set';
import { listCommand } from './list';

export const configCommands = new Command()
  .name('config')
  .description('Manage your local configuration')
  .addCommand(getCommand)
  .addCommand(setCommand)
  .addCommand(listCommand);
