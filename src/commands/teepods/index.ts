import { Command } from 'commander';
import { listCommand } from './list';
import { imagesCommand } from './images';

export const teepodsCommands = new Command()
  .name('teepods')
  .description('TEEPod management commands')
  .addCommand(listCommand)
  .addCommand(imagesCommand);
