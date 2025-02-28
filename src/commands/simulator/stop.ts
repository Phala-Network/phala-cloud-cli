import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { logger } from '../../utils/logger';

export const stopCommand = new Command()
  .name('stop')
  .description('Stop the TEE simulator')
  .action(async () => {
    try {
      // Stop the simulator
      const dockerService = new DockerService('');
      const success = await dockerService.stopSimulator();
      
      if (!success) {
        logger.error('Failed to stop TEE simulator');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to stop TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 