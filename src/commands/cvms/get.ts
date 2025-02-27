import { Command } from 'commander';
import { getCvmByAppId, getCvmsByUserId } from '../../api/cvms';
import { logger } from '../../utils/logger';
import inquirer from 'inquirer';

export const getCommand = new Command()
  .name('get')
  .description('Get details of a CVM')
  .option('-i, --id <app-id>', 'App ID of the CVM (optional)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      let appId = options.id;
      
      // If no app ID is provided, fetch all CVMs and let the user select one
      if (!appId) {
        const listSpinner = logger.startSpinner('Fetching available CVMs');
        const cvms = await getCvmsByUserId();
        listSpinner.stop(true);
        
        if (!cvms || cvms.length === 0) {
          logger.info('No CVMs found for your account');
          return;
        }
        
        // Prepare choices for the inquirer prompt
        const choices = cvms.map(cvm => {
          // Handle different API response formats
          const id = cvm.hosted?.app_id || cvm.hosted?.id;
          const name = cvm.name || (cvm.hosted && cvm.hosted.name);
          const status = cvm.status || (cvm.hosted && cvm.hosted.status);
          
          return {
            name: `${name || 'Unnamed'} (${id}) - Status: ${status || 'Unknown'}`,
            value: id
          };
        });
        
        const { selectedCvm } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedCvm',
            message: 'Select a CVM to view details:',
            choices
          }
        ]);
        
        appId = selectedCvm;
      }
      
      const spinner = logger.startSpinner(`Fetching CVM with App ID ${appId}`);
      
      const cvm = await getCvmByAppId(appId);
      
      spinner.stop(true);
      
      if (!cvm) {
        logger.error(`CVM with App ID ${appId} not found`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(cvm, null, 2));
        return;
      }
      
      logger.info(`CVM Details for App ID ${appId}:`);
      logger.info(`Name: ${cvm.name}`);
      logger.info(`Status: ${cvm.status}`);
      
      if (cvm.app_url) {
        logger.info(`App URL: ${cvm.app_url}`);
      }
      
      // Display additional details if available
      if (cvm.vcpu) logger.info(`vCPU: ${cvm.vcpu}`);
      if (cvm.memory) logger.info(`Memory: ${cvm.memory} MB`);
      if (cvm.disk_size) logger.info(`Disk Size: ${cvm.disk_size} GB`);
      if (cvm.image) logger.info(`Image: ${cvm.image}`);
      if (cvm.teepod_id) logger.info(`TEEPod ID: ${cvm.teepod_id}`);
    } catch (error) {
      logger.error(`Failed to get CVM details: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 