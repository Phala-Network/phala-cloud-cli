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
import { replicateCommand } from './replicate';
import { commitProvisionCommand } from './commit-provision';
import { provisionCommand } from './provision';
import { upgradeProvisionCommand } from './upgrade-provision';
import { upgradeCommitCommand } from './upgrade-commit';

export const cvmsCommand = new Command()
  .name('cvms')
  .description('Manage Phala Confidential Virtual Machines (CVMs)')
  .addCommand(attestationCommand)
  .addCommand(createCommand)
  .addCommand(deleteCommand)
  .addCommand(getCommand)
  .addCommand(listCommand)
  .addCommand(startCommand)
  .addCommand(stopCommand)
  .addCommand(resizeCommand)
  .addCommand(restartCommand)
  .addCommand(upgradeCommand)
  .addCommand(replicateCommand)
  .addCommand(commitProvisionCommand)
  .addCommand(provisionCommand)
  .addCommand(upgradeProvisionCommand)
  .addCommand(upgradeCommitCommand);