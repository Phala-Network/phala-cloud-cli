import { Command } from 'commander';
import { saveApiKey } from '@/src/utils/credentials';
import { logger } from '@/src/utils/logger';
import prompts from 'prompts';

export const loginCommand = new Command()
  .name('login')
  .description('Set the API key for authentication')
  .option('-k, --key <key>', 'API key to set')
  .action(async (options) => {
    try {
      let apiKey = options.key;
      
      // If no API key is provided, prompt for it
      if (!apiKey) {
        const response = await prompts({
          type: 'password',
          name: 'apiKey',
          message: 'Enter your API key:',
          validate: value => value.length > 0 ? true : 'API key cannot be empty'
        });
        
        if (!response.apiKey) {
          logger.error('API key is required');
          process.exit(1);
        }
        
        apiKey = response.apiKey;
      }
      
      // Save the API key (encrypted)
      await saveApiKey(apiKey);
      
      logger.success('API key saved successfully');
      logger.info('The API key will be validated on your next API call');
      logger.info('You can check your authentication status with "teecloud auth status"');
    } catch (error) {
      logger.error(`Failed to set API key: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 