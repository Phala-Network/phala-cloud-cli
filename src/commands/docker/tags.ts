import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { getDockerCredentials } from '../../utils/credentials';
import { logger } from '../../utils/logger';

export const tagsCommand = new Command()
  .name('tags')
  .description('List tags for a Docker image')
  .requiredOption('-i, --image <image>', 'Image name')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      // Get Docker credentials
      const credentials = await getDockerCredentials();
      
      if (!credentials) {
        logger.error('Docker credentials not found. Please login first with "teecloud docker login"');
        process.exit(1);
      }
      
      // List tags
      const dockerService = new DockerService(options.image, credentials.username, credentials.registry);
      const tags = await dockerService.listTags();
      
      if (tags.length === 0) {
        logger.info(`No tags found for image ${credentials.username}/${options.image}`);
        return;
      }
      
      if (options.json) {
        console.log(JSON.stringify(tags, null, 2));
        return;
      }
      
      logger.info(`Tags for image ${credentials.username}/${options.image}:`);
      tags.forEach(tag => {
        logger.info(`- ${tag}`);
      });
    } catch (error) {
      logger.error(`Failed to list tags: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 