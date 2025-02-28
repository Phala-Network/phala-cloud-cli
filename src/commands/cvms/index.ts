import { Command } from 'commander';
import { listCommand } from './list';
import { getCommand } from './get';
import { startCommand } from './start';
import { stopCommand } from './stop';
import { restartCommand } from './restart';
import { attestationCommand } from './attestation';
import { createCommand } from './create';
import { deleteCommand } from './delete';
import { upgradeCommand } from './upgrade';
import { resizeCommand } from './resize';

export const cvmsCommand = new Command()
  .name('cvms')
  .description('Manage Phala Confidential Virtual Machines (CVMs)')
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(upgradeCommand)
  .addCommand(startCommand)
  .addCommand(stopCommand)
  .addCommand(restartCommand)
  .addCommand(attestationCommand)
  .addCommand(deleteCommand)
  .addCommand(resizeCommand); 