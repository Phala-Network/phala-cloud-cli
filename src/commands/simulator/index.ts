import { Command } from 'commander';
import { startCommand } from './start';
import { stopCommand } from './stop';

export const simulatorCommands = new Command()
  .name('simulator')
  .description('TEE simulator commands')
  .addCommand(startCommand)
  .addCommand(stopCommand);
