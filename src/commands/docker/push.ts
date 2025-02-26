import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { getDockerCredentials } from '../../utils/credentials';
import { logger } from '../../utils/logger';

export const pushCommand = new Command()
  .name('push')
  .description('Push a Docker image to Docker Hub')
  .requiredOption('-i, --image <image>', 'Image name')
  .requiredOption('-t, --tag <tag>', 'Image tag')
  .action(async (options) => {
    try {
      // Get Docker credentials
      const credentials = await getDockerCredentials();
      
      if (!credentials) {
        logger.error('Docker credentials not found. Please login first with "teecloud docker login"');
        process.exit(1);
      }
      
      // Push the image
      const dockerService = new DockerService(options.image, credentials.username, credentials.registry);
      const success = await dockerService.pushImage(options.tag);
      
      if (!success) {
        logger.error('Failed to push Docker image');
        process.exit(1);
      }
      
      logger.success(`Docker image ${credentials.username}/${options.image}:${options.tag} pushed successfully`);
    } catch (error) {
      logger.error(`Failed to push Docker image: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 