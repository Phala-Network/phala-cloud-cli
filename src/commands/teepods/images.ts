import { Command } from 'commander';
import { getTeepodImages, getTeepods } from '@/src/api/teepods';
import { logger } from '@/src/utils/logger';
import inquirer from 'inquirer';

export const imagesCommand = new Command()
  .name('images')
  .description('List available images for a TEEPod')
  .option('-t, --teepod-id <teepodId>', 'TEEPod ID')
  .action(async (options) => {
    try {
      const spinner = logger.startSpinner(`Fetching images for TEEPod ${options.teepodId}`);
      
      if (!options.teepodId) {
        // Fetch available TEEPods
        const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
        const teepods = await getTeepods();
        teepodsSpinner.stop(true);

        if (teepods.length === 0) {
          logger.error('No TEEPods available. Please try again later.');
          process.exit(1);
        }

        // Use inquirer to select a TEEPod
        const { selectedTeepodId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTeepodId',
            message: 'Select a TEEPod:',
            choices: teepods.map(pod => ({
              name: `${pod.name} (${pod.status})`,
              value: pod.id
            }))
          }
        ]);
        
        options.teepodId = selectedTeepodId;
      }
      
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