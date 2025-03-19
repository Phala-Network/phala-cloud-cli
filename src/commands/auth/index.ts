import { Command } from 'commander';
import { loginCommand } from './login';
import { logoutCommand } from './logout';
import { statusCommand } from './status';

export const authCommands = new Command()
  .name('auth')
  .description('Authenticate with Phala Cloud')
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(statusCommand);
