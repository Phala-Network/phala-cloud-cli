import { Command } from 'commander';
import { listCommand } from './list';
import { imagesCommand } from './images';

export function teepodsCommands(program: Command): void {
  const teepods = program
    .command('teepods')
    .description('TEEPod management commands');

  teepods.addCommand(listCommand);
  teepods.addCommand(imagesCommand);
} 