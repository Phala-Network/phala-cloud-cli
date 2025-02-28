import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { logger } from '../../utils/logger';
import { TEE_SIMULATOR } from '../../utils/constants';

export const startCommand = new Command()
  .name('start')
  .description('Start the TEE simulator')
  .option('-i, --image <image>', 'Simulator image', TEE_SIMULATOR)
  .action(async (options) => {
    try {
      // Start the simulator
      const dockerService = new DockerService('');
      const success = await dockerService.runSimulator(options.image);
      
      if (!success) {
        logger.error('Failed to start TEE simulator');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to start TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 