import { Command } from 'commander';
import { getTeepodImages } from '../../api/teepods';
import { logger } from '../../utils/logger';

export const imagesCommand = new Command()
  .name('images')
  .description('List available images for a TEEPod')
  .requiredOption('-t, --teepod-id <teepodId>', 'TEEPod ID')
  .action(async (options) => {
    try {
      const spinner = logger.startSpinner(`Fetching images for TEEPod ${options.teepodId}`);
      
      const images = await getTeepodImages(options.teepodId);
      
      spinner.stop(true);
      
      if (images.length === 0) {
        logger.info(`No images found for TEEPod ${options.teepodId}`);
        return;
      }
      
      logger.info(`Available images for TEEPod ${options.teepodId}:`);
      logger.table(images, ['name', 'description']);
    } catch (error) {
      logger.error(`Failed to list images: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 