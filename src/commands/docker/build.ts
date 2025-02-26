import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { getDockerCredentials } from '../../utils/credentials';
import { logger } from '../../utils/logger';
import path from 'path';

export const buildCommand = new Command()
  .name('build')
  .description('Build a Docker image')
  .requiredOption('-i, --image <image>', 'Image name')
  .requiredOption('-t, --tag <tag>', 'Image tag')
  .option('-f, --file <file>', 'Path to Dockerfile', 'Dockerfile')
  .action(async (options) => {
    try {
      // Get Docker credentials
      const credentials = await getDockerCredentials();
      
      if (!credentials) {
        logger.error('Docker credentials not found. Please login first with "teecloud docker login"');
        process.exit(1);
      }
      
      // Resolve the Dockerfile path
      const dockerfilePath = path.resolve(process.cwd(), options.file);
      
      // Build the image
      const dockerService = new DockerService(options.image, credentials.username, credentials.registry);
      const success = await dockerService.buildImage(dockerfilePath, options.tag);
      
      if (!success) {
        logger.error('Failed to build Docker image');
        process.exit(1);
      }
      
      logger.success(`Docker image ${credentials.username}/${options.image}:${options.tag} built successfully`);
    } catch (error) {
      logger.error(`Failed to build Docker image: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 