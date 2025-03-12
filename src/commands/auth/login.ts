import { Command } from 'commander';
import { removeApiKey, saveApiKey } from '@/src/utils/credentials';
import { logger } from '@/src/utils/logger';
import prompts from 'prompts';
import { getUserInfo } from '@/src/api/auth';

export const loginCommand = new Command()
  .name('login')
  .description('Set the API key for authentication')
  .argument('[api-key]', 'Phala Cloud API key to set')
  .action(async (apiKey?: string) => {
    try {
      let checkUserInfo;
      // If no API key is provided, prompt for it
      if (!apiKey) {
        const response = await prompts({
          type: 'password',
          name: 'apiKey',
          message: 'Enter your API key:',
          validate: async (value) => {
            if (value.length === 0) {
              return 'API key cannot be empty';
            } else {
              try {
                await saveApiKey(value);
                checkUserInfo = await getUserInfo();
                if (!checkUserInfo.username) {
                  await removeApiKey();
                  return 'Invalid API key';
                }
              } catch (error) {
                return 'Invalid API key';
              }
            }
            return true;
          }
        });
        
        apiKey = response.apiKey;
      } else {
        // Validate the API key
        checkUserInfo = await getUserInfo();
        if (!checkUserInfo.username) {
          await removeApiKey();
          return 'Invalid API key';
        }
      }
      
      logger.success(`Welcome ${checkUserInfo.username}! API key validated and saved successfully\n`);
      
      logger.info(`\nOpen in Web UI at https://phala.cloud/dashboard`);
    } catch (error) {
      logger.error(`Failed to set API key: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 