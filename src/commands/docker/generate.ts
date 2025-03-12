import { Command } from 'commander';
import { DockerService } from '../../utils/docker';
import { getDockerCredentials } from '../../utils/credentials';
import { logger } from '../../utils/logger';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { validateFileExists } from '../../utils/prompts';

export const generateCommand = new Command()
  .name('generate')
  .description('Generate a Docker Compose file')
  .option('-i, --image <image>', 'Docker image name to use in the compose file')
  .option('-t, --tag <tag>', 'Docker image tag to use in the compose file')
  .option('-e, --env-file <envFile>', 'Path to environment variables file')
  .option('-o, --output <output>', 'Output path for generated docker-compose.yml')
  .option('--template <template>', 'Template to use for the generated docker-compose.yml', )
  .option('--manual', 'Skip automatic image detection and enter image/tag manually')
  .action(async (options) => {
    try {
      // Get Docker credentials to create the Docker service
      const credentials = await getDockerCredentials();
      if (!credentials || !credentials.username) {
        logger.error('Docker Hub username not found. Please login first with `phala docker login`');
        process.exit(1);
      }

      // Variables to hold selected image and tag
      let selectedImage = options.image || '';
      let selectedTag = options.tag || '';
      
      // If image or tag not provided and manual mode not specified, detect and offer local images
      if ((!selectedImage || !selectedTag) && !options.manual) {
        try {
          logger.info('Detecting local Docker images...');
          const localImages = await DockerService.listLocalImages();
          
          if (localImages.length === 0) {
            logger.warn('No local Docker images found. You will need to enter image details manually.');
          } else {
            // Group images by name
            const imageMap = new Map<string, string[]>();
            
            localImages.forEach(image => {
              if (!imageMap.has(image.name)) {
                imageMap.set(image.name, []);
              }
              imageMap.get(image.name)?.push(image.tag);
            });
            
            // If image is already specified, but tag isn't, just select tag for the image
            if (selectedImage && !selectedTag) {
              const availableTags = imageMap.get(selectedImage) || [];
              if (availableTags.length > 0) {
                // Ask user to select a tag
                const { imageTag } = await inquirer.prompt([
                  {
                    type: 'list',
                    name: 'imageTag',
                    message: `Select a tag for ${selectedImage}:`,
                    choices: [...availableTags, new inquirer.Separator(), '[ Enter manually ]']
                  }
                ]);
                
                if (imageTag !== '[ Enter manually ]') {
                  selectedTag = imageTag;
                }
              } else {
                logger.warn(`No tags found for image ${selectedImage}. You will need to enter the tag manually.`);
              }
            } 
            // If image is not specified, ask for both image and tag
            else if (!selectedImage) {
              // Ask user to select an image name
              const imageNames = Array.from(imageMap.keys());
              const { imageName } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'imageName',
                  message: 'Select a Docker image:',
                  choices: [...imageNames, new inquirer.Separator(), '[ Enter manually ]']
                }
              ]);
              
              if (imageName === '[ Enter manually ]') {
                // User chose to enter manually, go to manual input flow
              } else {
                selectedImage = imageName;
                
                // Get available tags for selected image
                const availableTags = imageMap.get(imageName) || [];
                
                // Ask user to select a tag
                const { imageTag } = await inquirer.prompt([
                  {
                    type: 'list',
                    name: 'imageTag',
                    message: 'Select a tag:',
                    choices: [...availableTags, new inquirer.Separator(), '[ Enter manually ]']
                  }
                ]);
                
                if (imageTag !== '[ Enter manually ]') {
                  selectedTag = imageTag;
                }
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to detect local images: ${error instanceof Error ? error.message : String(error)}`);
          logger.info('Continuing with manual input...');
        }
      }
      
      // If image still not set, prompt for it
      if (!selectedImage) {
        const { inputImage } = await inquirer.prompt([
          {
            type: 'input',
            name: 'inputImage',
            message: 'Enter Docker image name:',
            validate: (input) => {
              if (!input.trim()) {
                return 'Image name cannot be empty';
              }
              return true;
            }
          }
        ]);
        selectedImage = inputImage;
      }
      
      // If tag still not set, prompt for it
      if (!selectedTag) {
        const { inputTag } = await inquirer.prompt([
          {
            type: 'input',
            name: 'inputTag',
            message: `Enter tag for image ${selectedImage}:`,
            validate: (input) => {
              if (!input.trim()) {
                return 'Tag cannot be empty';
              }
              return true;
            }
          }
        ]);
        selectedTag = inputTag;
      }

      // Get environment file path from options or prompt
      let envFilePath = options.envFile;
      if (!envFilePath) {
        // Check if .env exists in current directory
        const defaultEnvPath = path.join(process.cwd(), '.env');
        const hasDefaultEnv = fs.existsSync(defaultEnvPath);

        if (hasDefaultEnv) {
          const { useDefault } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'useDefault',
              message: 'Use .env file in current directory?',
              default: true
            }
          ]);

          if (useDefault) {
            envFilePath = defaultEnvPath;
          }
        }

        // If still no env file path, prompt for it
        if (!envFilePath) {
          const { envPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'envPath',
              message: 'Enter path to environment variables file:',
              validate: (input) => {
                try {
                  validateFileExists(input);
                  return true;
                } catch (error) {
                  return `File not found: ${input}`;
                }
              }
            }
          ]);
          envFilePath = envPath;
        }
      } else {
        // Validate the provided env file path
        try {
          validateFileExists(envFilePath);
        } catch (error) {
          logger.error(`File not found: ${envFilePath}`);
          process.exit(1);
        }
      }

      // Get output path from options or set default
      let outputPath = options.output;
      if (!outputPath) {
        outputPath = path.join(process.cwd(), 'docker-compose.yml');
        
        // If file already exists, confirm overwrite
        if (fs.existsSync(outputPath)) {
          const { confirmOverwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmOverwrite',
              message: `File ${outputPath} already exists. Overwrite?`,
              default: false
            }
          ]);
          if (!confirmOverwrite) {
            const { customPath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customPath',
                message: 'Enter alternative output path:',
                default: path.join(process.cwd(), 'docker-generated-compose.yml')
              }
            ]);
            outputPath = customPath;
          }
        }
      }
      
      // Create a DockerService instance
      const dockerService = new DockerService(selectedImage, credentials.username, credentials.registry);

      // Generate the Docker Compose file
      if (envFilePath) {
        logger.info(`Generating Docker Compose file for ${selectedImage}:${selectedTag} using env file: ${envFilePath}`);
      } else {
        logger.info(`Generating Docker Compose file for ${selectedImage}:${selectedTag} without env file`);
      }
      const composePath = await dockerService.buildComposeFile(selectedTag, envFilePath, options.template);
      
      // Copy the generated file to the output path if needed
      if (composePath !== outputPath) {
        // Ensure the output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          logger.info(`Creating directory: ${outputDir}`);
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.copyFileSync(composePath, outputPath);
      }
      
      logger.success(`Docker Compose file generated successfully: ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to generate Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 