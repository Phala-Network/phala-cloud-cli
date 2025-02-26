import { Command } from 'commander';
import { getCommand } from './get';
import { setCommand } from './set';
import { listCommand } from './list';

export function configCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Configuration commands');

  config.addCommand(getCommand);
  config.addCommand(setCommand);
  config.addCommand(listCommand);
} 