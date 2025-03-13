import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { logger } from '../../utils/logger';
import { stopSimulator } from '@/src/utils/simulator';

export const stopCommand = new Command()
  .name('stop')
  .description('Stop the TEE simulator')
  .option('-t, --type <type>', 'Simulator type (docker, native)', 'docker')
  .action(async (options) => {
    try {
      if (options.type === 'docker') {
        // Stop the simulator
        const dockerService = new DockerService('');
        const success = await dockerService.stopSimulator();
        
        if (!success) {
          logger.error('Failed to stop TEE simulator');
          process.exit(1);
        }
      } else if (options.type === 'native') {
        // Stop the native simulator
        const success = await stopSimulator();
        
        if (!success) {
          logger.error('Failed to stop TEE simulator');
          process.exit(1);
        }
      } else {
        logger.error('Invalid simulator type');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to stop TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });