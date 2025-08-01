import { Command } from 'commander';
import { listNodes } from './list.js';
import { setCommandResult, setCommandError } from '@/src/utils/commander.js';

async function handleListNodes(this: Command) {
  try {
    const result = await listNodes(this);
    setCommandResult(this, result);
    return; // Return void to match Commander's expected signature
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setCommandError(this, new Error(errorMessage));
    throw error;
  }
}

export const nodesCommand = new Command()
  .name('nodes')
  .description('List and manage TEE nodes')
  .action(handleListNodes)
  .addCommand(
    new Command('list')
      .description('List all available worker nodes')
      .alias('ls')
      .action(handleListNodes)
  );
