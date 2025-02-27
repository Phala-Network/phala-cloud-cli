import { Command } from 'commander';
import { listCommand } from './list';
import { getCommand } from './get';
import { startCommand } from './start';
import { stopCommand } from './stop';
import { restartCommand } from './restart';
import { logsCommand } from './logs';
import { createCommand } from './create';
import { deleteCommand } from './delete';
import { upgradeCommand } from './upgrade';

export const cvmsCommand = new Command()
  .name('cvms')
  .description('Manage Cloud Virtual Machines (CVMs)')
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  // .addCommand(upgradeCommand)
  // .addCommand(startCommand)
  // .addCommand(stopCommand)
  // .addCommand(restartCommand)
  // .addCommand(logsCommand)
  // .addCommand(deleteCommand); 