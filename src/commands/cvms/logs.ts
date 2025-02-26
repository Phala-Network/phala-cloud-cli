import { Command } from 'commander';
import { getCvmLogs } from '../../api/cvms';
import { logger } from '../../utils/logger';

export const logsCommand = new Command()
  .name('logs')
  .description('View logs for a CVM')
  .argument('<app-id>', 'App ID of the CVM')
  .option('-f, --follow', 'Follow log output')
  .action(async (appId, options) => {
    try {
      const spinner = logger.startSpinner(`Fetching logs for CVM with App ID ${appId}`);
      
      const logs = await getCvmLogs(appId);
      
      spinner.stop(true);
      
      if (!logs || logs.length === 0) {
        logger.info(`No logs found for CVM with App ID ${appId}`);
        return;
      }
      
      logger.info(`Logs for CVM with App ID ${appId}:`);
      console.log(logs);
      
      if (options.follow) {
        logger.info('Following logs... Press Ctrl+C to stop');
        
        // Set up polling for logs
        const pollInterval = setInterval(async () => {
          try {
            const newLogs = await getCvmLogs(appId);
            if (newLogs && newLogs !== logs) {
              console.log(newLogs);
            }
          } catch (error) {
            logger.error(`Failed to fetch logs: ${error instanceof Error ? error.message : String(error)}`);
            clearInterval(pollInterval);
          }
        }, 5000);
        
        // Handle Ctrl+C to stop polling
        process.on('SIGINT', () => {
          clearInterval(pollInterval);
          logger.info('Stopped following logs');
          process.exit(0);
        });
      }
    } catch (error) {
      logger.error(`Failed to get logs: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 