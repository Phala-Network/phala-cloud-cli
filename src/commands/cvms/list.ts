import { Command } from 'commander';
import { getCvms } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { CLOUD_URL } from '@/src/utils/constants';
import chalk from 'chalk';

export const listCommand = new Command()
  .name('list')
  .alias('ls')
  .description('List all CVMs')
  .option('-j, --json', 'Output in JSON format')
  .action(async function(this: Command, options) {
    // Initialize telemetry data
    const telemetryData: any = {
      timestamp: new Date().toISOString(),
      jsonOutput: options.json || false,
      cvmCount: 0,
      success: false
    };

    try {
      const spinner = logger.startSpinner('Fetching CVMs');
      
      const cvms = await getCvms();
      
      spinner.stop(true);
      
      if (!cvms || cvms.length === 0) {
        const message = 'No CVMs found';
        setCommandResult(this, {
          ...telemetryData,
          success: true,
          message
        });
        logger.info(message);
        return;
      }
      
      // Update telemetry with CVM count
      telemetryData.cvmCount = cvms.length;
      
      // Count statuses for telemetry
      const statusCounts = cvms.reduce((acc, cvm) => {
        acc[cvm.status] = (acc[cvm.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      telemetryData.statusCounts = statusCounts;
      
      if (options.json) {
        console.log(JSON.stringify(cvms, null, 2));
        setCommandResult(this, {
          ...telemetryData,
          success: true,
          message: 'CVMs listed successfully in JSON format'
        });
        return;
      }
      
      for (const cvm of cvms) {
        logger.keyValueTable({
            Name: cvm.name,
            "App ID": `app_${cvm.hosted.app_id}`,
            "CVM ID": cvm.hosted.id.replace(/-/g, ''),
            "Region": cvm.node.region_identifier,
            Status:
              cvm.status === "running"
                ? chalk.green(cvm.status)
                : cvm.status === "stopped"
                  ? chalk.red(cvm.status)
                  : chalk.yellow(cvm.status),
            "Node Info URL": cvm.hosted.app_url,
            "App URL": `${CLOUD_URL}/dashboard/cvms/${cvm.hosted.id.replace(/-/g, '')}`,
        });
        logger.break();
      }
      // Update telemetry for successful operation
      setCommandResult(this, {
        ...telemetryData,
        success: true,
        message: 'CVMs listed successfully'
      });
      
      logger.success(`Found ${cvms.length} CVMs`);
      logger.break();
      logger.info(`Go to ${CLOUD_URL}/dashboard/ to view your CVMs`);
    } catch (error) {
      const errorMessage = `Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`;
      setCommandError(this, new Error(errorMessage));
      logger.error(errorMessage);
      // Don't call process.exit() to ensure telemetry is sent
      throw error;
    }
  }); 