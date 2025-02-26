import { Command } from 'commander';
import { startCommand } from './start';
import { stopCommand } from './stop';

export function simulatorCommands(program: Command): void {
  const simulator = program
    .command('simulator')
    .description('TEE simulator commands');

  simulator.addCommand(startCommand);
  simulator.addCommand(stopCommand);
} 