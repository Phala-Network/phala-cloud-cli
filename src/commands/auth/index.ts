import { Command } from 'commander';
import { loginCommand } from './login';
import { logoutCommand } from './logout';
import { statusCommand } from './status';

export function authCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Authentication commands');

  auth.addCommand(loginCommand);
  auth.addCommand(logoutCommand);
  auth.addCommand(statusCommand);
} 