import { Command } from 'commander';
import { checkCvmExists, getCvmByAppId, resizeCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
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
  .action(async function(this: Command, appId, options) {
    // Initialize telemetry data
    const telemetryData: any = {
      timestamp: new Date().toISOString(),
      autoConfirm: options.yes || false,
      appId: '',
      originalVcpu: 0,
      newVcpu: 0,
      originalMemory: 0,
      newMemory: 0,
      originalDiskSize: 0,
      newDiskSize: 0,
      allowRestart: false,
      success: false
    };

    try {
      const resolvedAppId = await resolveCvmAppId(appId);
      telemetryData.appId = `${resolvedAppId}`;

      const cvm = await getCvmByAppId(resolvedAppId);
      
      // Store original values
      telemetryData.originalVcpu = cvm.vcpu;
      telemetryData.originalMemory = cvm.memory;
      telemetryData.originalDiskSize = cvm.disk_size;
      
      // Initialize parameters
      let vcpu: number | undefined = options.vcpu ? Number(options.vcpu) : undefined;
      let memory: number | undefined = options.memory ? Number(options.memory) : undefined;
      let diskSize: number | undefined = options.diskSize ? Number(options.diskSize) : undefined;
      let allowRestart: boolean | undefined = options.allowRestart;
      
      // Update telemetry with new values if provided
      if (vcpu) telemetryData.newVcpu = vcpu;
      if (memory) telemetryData.newMemory = memory;
      if (diskSize) telemetryData.newDiskSize = diskSize;
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
            default: cvm.vcpu.toString(),
            filter: (input) => parseInt(input)
          }
        ]);
        vcpu = response.vcpu;
        telemetryData.newVcpu = vcpu;
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
            default: cvm.memory.toString(),
            filter: (input) => parseInt(input)
          }
        ]);
        memory = response.memory;
        telemetryData.newMemory = memory;
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
            default: cvm.disk_size.toString(),
            filter: (input) => parseInt(input)
          }
        ]);
        diskSize = response.diskSize;
        telemetryData.newDiskSize = diskSize;
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
        telemetryData.allowRestart = allowRestart;
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
          const message = 'Resize operation cancelled by user';
          setCommandResult(this, {
            ...telemetryData,
            success: false,
            message
          });
          logger.info(message);
          return;
        }
      }
      
      const spinner = logger.startSpinner(`Resizing CVM with App ID app_${resolvedAppId}`);
      
      // Convert boolean to number (0 or 1) as expected by the API
      const allowRestartValue = allowRestart ? 1 : 0;
      
      await resizeCvm(resolvedAppId, vcpu, memory, diskSize, allowRestartValue);

      spinner.stop(true);
      
      // Update telemetry data for successful resize
      telemetryData.success = true;
      setCommandResult(this, {
        ...telemetryData,
        message: 'CVM resize initiated successfully'
      });
      
      logger.break();
      logger.success(
        `Your CVM is being resized. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`
      );
    } catch (error) {
      const errorMessage = `Failed to resize CVM: ${error instanceof Error ? error.message : String(error)}`;
      setCommandError(this, new Error(errorMessage));
      logger.error(errorMessage);
      // Don't call process.exit() to ensure telemetry is sent
      throw error;
    }
  }); 