import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { stopSimulator } from '@/src/utils/simulator';

export const stopCommand = new Command()
  .name('stop')
  .description('Stop the TEE simulator')
  .action(async () => {
    try {
      // Stop the simulator
      const success = await stopSimulator();
      
      if (!success) {
        logger.error('Failed to stop TEE simulator');
        process.exit(1);
      }
      
      logger.success('TEE simulator stopped successfully');
    } catch (error) {
      logger.error(`Failed to stop TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });