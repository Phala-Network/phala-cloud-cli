import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { getDockerCredentials } from '../../utils/credentials';
import { logger } from '../../utils/logger';
import inquirer from 'inquirer';

export const pushCommand = new Command()
  .name('push')
  .description('Push a Docker image to Docker Hub')
  .option('-i, --image <image>', 'Image name')
  .option('-t, --tag <tag>', 'Image tag')
  .action(async (options) => {
    try {
      // Get Docker credentials
      const credentials = await getDockerCredentials();
      
      if (!credentials) {
        logger.error('Docker credentials not found. Please login first with "phala docker login"');
        process.exit(1);
      }

      let imageName = options.image;
      let imageTag = options.tag;

      // If image or tag is not provided, list local images and prompt user to select
      if (!imageName || !imageTag) {
        const localImages = await DockerService.listLocalImages();
        
        if (localImages.length === 0) {
          logger.error('No local Docker images found. Please build an image first with "phala docker build"');
          process.exit(1);
        }

        // If no image specified, prompt to select from available images
        if (!imageName) {
          // Get unique image names
          const uniqueImageNames = Array.from(new Set(localImages.map(img => img.name)));
          
          const { selectedImage } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedImage',
              message: 'Select an image to push:',
              choices: uniqueImageNames
            }
          ]);
          
          imageName = selectedImage;
        }
        
        // If no tag specified, prompt to select from available tags for the image
        if (!imageTag) {
          // Filter tags for the selected image
          const availableTags = localImages
            .filter(img => img.name === imageName)
            .map(img => img.tag);
          
          if (availableTags.length === 0) {
            logger.error(`No tags found for image ${imageName}`);
            process.exit(1);
          }
          
          const { selectedTag } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedTag',
              message: `Select a tag for ${imageName}:`,
              choices: availableTags
            }
          ]);
          
          imageTag = selectedTag;
        }
      }
      
      // Push the image
      const dockerService = new DockerService(imageName, credentials.username, credentials.registry);
      const success = await dockerService.pushImage(imageTag);
      
      if (!success) {
        logger.error('Failed to push Docker image');
        process.exit(1);
      }
      
      logger.success(`Docker image ${credentials.username}/${imageName}:${imageTag} pushed successfully`);
    } catch (error) {
      logger.error(`Failed to push Docker image: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 