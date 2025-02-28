import { Command } from 'commander';
import { getCvmByAppId, resizeCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import inquirer from 'inquirer';

export const resizeCommand = new Command()
  .name('resize')
  .description('Resize resources for a CVM')
  .argument('[app-id]', 'App ID of the CVM (if not provided, a selection prompt will appear)')
  .option('-v, --vcpu <vcpu>', 'Number of virtual CPUs')
  .option('-m, --memory <memory>', 'Memory size in MB')
  .option('-d, --disk-size <diskSize>', 'Disk size in GB')
  .option('-r, --allow-restart <allowRestart>', 'Allow restart of the CVM if needed for resizing')
  .option('-y, --yes', 'Automatically confirm the resize operation')
  .action(async (appId, options) => {
    try {
      // If no app ID is provided, prompt user to select one
      if (!appId) {
        appId = await selectCvm();
        if (!appId) {
          logger.info('No CVMs found or selection cancelled');
          return;
        }
      }

      const cvm = await getCvmByAppId(appId);
      
      // Initialize parameters
      let vcpu: number | undefined = options.vcpu;
      let memory: number | undefined = options.memory;
      let diskSize: number | undefined = options.diskSize;
      let allowRestart: boolean | undefined = options.allowRestart;
      // Prompt for vCPU if selected
      if (!vcpu) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'vcpu',
            message: 'Enter number of vCPUs:',
            validate: (input) => {
              const num = parseInt(input);
              if (isNaN(num) || num < 0) {
                return 'Please enter a valid non-negative number';
              }
              return true;
            },
            default: cvm.vcpu,
            filter: (input) => parseInt(input)
          }
        ]);
        vcpu = response.vcpu;
      }
      
      // Prompt for memory
      if (!memory) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'memory',
            message: 'Enter memory in MB:',
            validate: (input) => {
              const num = parseInt(input);
              if (isNaN(num) || num < 0) {
                return 'Please enter a valid non-negative number';
              }
              return true;
            },
            default: cvm.memory,
            filter: (input) => parseInt(input)
          }
        ]);
        memory = response.memory;
      }
      
      // Prompt for disk size
      if (!diskSize) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'diskSize',
            message: 'Enter disk size in GB:',
            validate: (input) => {
              const num = parseInt(input);
              if (isNaN(num) || num < 0) {
                return 'Please enter a valid non-negative number';
              }
              return true;
            },
            default: cvm.disk_size,
            filter: (input) => parseInt(input)
          }
        ]);
        diskSize = response.diskSize;
      }
      
      // Ask about restart permission
      if (!allowRestart) {
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'allowRestart',
            message: 'Allow restart of the CVM if needed for resizing?',
            default: false
          }
        ]);
        allowRestart = response.allowRestart;
      }
      
      // Prepare confirmation message
      let confirmMessage = `Are you sure you want to resize CVM ${appId} with the following changes:\n`;
      logger.keyValueTable(
        { 'vCPUs': cvm.vcpu !== vcpu ? `${cvm.vcpu} -> ${vcpu}` : cvm.vcpu,
         'Memory': cvm.memory !== memory ? `${cvm.memory} MB -> ${memory} MB` : cvm.memory,
         'Disk Size': cvm.disk_size !== diskSize ? `${cvm.disk_size} GB -> ${diskSize} GB` : cvm.disk_size,
         'Allow Restart': allowRestart ? 'Yes' : 'No' }
      );
      
      // Confirm the resize operation
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: confirmMessage,
          default: false
          }
        ]);
        
        if (!confirm) {
          logger.info('Resize operation cancelled');
          return;
        }
      }
      
      const spinner = logger.startSpinner(`Resizing CVM with App ID ${appId}`);
      
      // Convert boolean to number (0 or 1) as expected by the API
      const allowRestartValue = allowRestart ? 1 : 0;
      
      await resizeCvm(appId, vcpu, memory, diskSize, allowRestartValue);
      
      spinner.stop(true);
      logger.success(`CVM with App ID ${appId} resized successfully`);
    } catch (error) {
      logger.error(`Failed to resize CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 