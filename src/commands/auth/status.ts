import { Command } from 'commander';
import { getApiKey } from '@/src/utils/credentials';
import { getUserInfo } from '@/src/api/auth';
import { logger } from '@/src/utils/logger';

export const statusCommand = new Command()
  .name('status')
  .description('Check authentication status')
  .option('-j, --json', 'Output in JSON format')
  .option('-d, --debug', 'Enable debug output')
  .action(async (options) => {
    try {
      // Enable debug mode if requested
      if (options.debug) {
        process.env.DEBUG = 'true';
      }
      
      const apiKey = await getApiKey();
      
      if (!apiKey) {
        logger.warn('Not authenticated. Please set an API key with "phala auth login"');
        return;
      }
      
      logger.debug(`Using API key: ${apiKey.substring(0, 5)}...`);
      const spinner = logger.startSpinner('Checking authentication status');
      
      try {
        const userInfo = await getUserInfo();
        spinner.stop(true);
        
        if (options.json) {
          console.log(JSON.stringify(userInfo, null, 2));
          return;
        }
        
        logger.break();
        logger.success(`Authenticated as ${userInfo.username}`);
        
        // Create a simple object
        const tableData = {
          'Username': userInfo.username,
          'Email': userInfo.email,
          'Role': userInfo.role,
          'Team': `${userInfo.team_name} (${userInfo.team_tier})`,
          'Credits': `$${(userInfo.credits + userInfo.granted_credits).toFixed(2)}`
        };
        
        if (userInfo.trial_ended_at) {
          tableData['Trial Ended At'] = userInfo.trial_ended_at;
        }
        
        // Display the table
        logger.keyValueTable(tableData, {
          borderStyle: 'rounded'
        });
      } catch (error) {
        spinner.stop(false);
        logger.error('Authentication failed. Your API key may be invalid or expired.');
        logger.info('Please set a new API key with "phala auth login"');
        
        if (options.debug) {
          logger.debug(`Error details: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to check authentication status: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 