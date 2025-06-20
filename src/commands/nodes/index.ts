import { Command } from 'commander';
import { listNodes } from './list.js';

export const nodesCommand = new Command()
  .name('nodes')
  .description('List and manage TEE nodes')
  .action(listNodes)
  .addCommand(
    new Command('list')
      .description('List all available worker nodes')
      .alias('ls')
      .action(listNodes)
  );
