import { Command } from 'commander';
import { loginCommand } from './login';
import { buildCommand } from './build';
import { pushCommand } from './push';
import { tagsCommand } from './tags';

export const dockerCommands = new Command()
  .name('docker')
  .description('Docker management commands')
  .addCommand(loginCommand)
  .addCommand(buildCommand)
  .addCommand(pushCommand)
  .addCommand(tagsCommand);
