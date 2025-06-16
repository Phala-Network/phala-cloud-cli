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
import { listNodesCommand } from './list-node';
import { replicateCommand } from './replicate';
import { provisionCommand } from './provision';
import { listNodesCommand } from './list-nodes';
import { updateCommand } from './update';

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
  .addCommand(listNodesCommand)
  .addCommand(replicateCommand)
  .addCommand(provisionCommand)
  .addCommand(listNodesCommand)
  .addCommand(updateCommand);