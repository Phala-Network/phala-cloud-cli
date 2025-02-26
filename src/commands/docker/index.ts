import { Command } from 'commander';
import { loginCommand } from './login';
import { buildCommand } from './build';
import { pushCommand } from './push';
import { tagsCommand } from './tags';

export function dockerCommands(program: Command): void {
  const docker = program
    .command('docker')
    .description('Docker management commands');

  docker.addCommand(loginCommand);
  docker.addCommand(buildCommand);
  docker.addCommand(pushCommand);
  docker.addCommand(tagsCommand);
} 