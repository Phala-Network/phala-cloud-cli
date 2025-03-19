import { Command } from 'commander';
import { DockerService } from '@/src/utils/docker';
import { logger } from '@/src/utils/logger';
import { TEE_SIMULATOR } from '@/src/utils/constants';
import { installSimulator, isSimulatorInstalled, isSimulatorRunning, runSimulator } from '@/src/utils/simulator';

export const startCommand = new Command()
  .name('start')
  .description('Start the TEE simulator')
  .option('-i, --image <image>', 'Simulator image', TEE_SIMULATOR)
  .option('-p, --port <port>', 'Simulator port (default: 8090)', '8090')
  .option('-t, --type <type>', 'Simulator type (docker, native)', 'docker')
  .action(async (options) => {
    try {
      if (options.type === 'docker') {
        // Start the simulator
        const dockerService = new DockerService('');
        const success = await dockerService.runSimulator(options.image, options.port);
        
        if (!success) {
          logger.error('Failed to start TEE simulator');
          process.exit(1);
        }
      } else if (options.type === 'native') {
        if (!isSimulatorInstalled()) {
          await installSimulator();
        }
        const running = await isSimulatorRunning();
        if (running) {
          logger.success('TEE simulator is already running');
          return;
        } else {
          const simulatorProcess = runSimulator();
          logger.success('TEE simulator started successfully');
        }
      } else {
        logger.error('Invalid simulator type');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to start TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 