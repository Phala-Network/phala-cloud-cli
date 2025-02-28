import { Command } from 'commander';
import { loginCommand } from './login';
import { buildCommand } from './build';
import { pushCommand } from './push';
import { tagsCommand } from './tags';

export const dockerCommands = new Command()
  .name('docker')
  .description('Login to Docker Hub and manage Docker images')
  .addCommand(loginCommand)
  .addCommand(buildCommand)
  .addCommand(pushCommand)
  .addCommand(tagsCommand);
