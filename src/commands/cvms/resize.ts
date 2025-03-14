import { Command } from 'commander';
import { checkCvmExists, getCvmByAppId, resizeCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { resolveCvmAppId } from '@/src/utils/cvms';
import { CLOUD_URL } from '@/src/utils/constants';

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
      const resolvedAppId = await resolveCvmAppId(appId);

      const cvm = await getCvmByAppId(resolvedAppId);
      
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
      const confirmMessage = `Are you sure you want to resize CVM app_${resolvedAppId} with the following changes:\n`;
      logger.keyValueTable(
        { 'vCPUs': cvm.vcpu !== vcpu ? `${chalk.red(cvm.vcpu)} -> ${chalk.green(vcpu)}` : cvm.vcpu,
         'Memory': cvm.memory !== memory ? `${chalk.red(cvm.memory)} MB -> ${chalk.green(memory)} MB` : cvm.memory,
         'Disk Size': cvm.disk_size !== diskSize ? `${chalk.red(cvm.disk_size)} GB -> ${chalk.green(diskSize)} GB` : cvm.disk_size,
         'Allow Restart': allowRestart ? chalk.green('Yes') : chalk.red('No') }
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
      
      const spinner = logger.startSpinner(`Resizing CVM with App ID app_${resolvedAppId}`);
      
      // Convert boolean to number (0 or 1) as expected by the API
      const allowRestartValue = allowRestart ? 1 : 0;
      
      await resizeCvm(resolvedAppId, vcpu, memory, diskSize, allowRestartValue);

      spinner.stop(true);
      logger.break();
      logger.success(
        `Your CVM is being resized. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`
      );
    } catch (error) {
      logger.error(
        `Failed to resize CVM: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }); 