import { Command } from 'commander';
import { checkCvmExists, restartCvm, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { resolveCvmAppId } from '@/src/utils/cvms';
import { CLOUD_URL } from '@/src/utils/constants';

export const restartCommand = new Command()
  .name('restart')
  .description('Restart a CVM')
  .argument('[app-id]', 'App ID of the CVM (if not provided, a selection prompt will appear)')
  .action(async (appId) => {
    try {
      const resolvedAppId = await resolveCvmAppId(appId);

      const spinner = logger.startSpinner(
        `Restarting CVM with App ID app_${resolvedAppId}`,
      );

      const response = await restartCvm(resolvedAppId);

      spinner.stop(true);
      logger.break();

      const tableData = {
        'CVM ID': response.id,
        'Name': response.name,
        'Status': response.status,
        'App ID': `app_${response.app_id}`,
        'App URL': response.app_url
          ? response.app_url
          : `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
      };
      logger.keyValueTable(tableData, {
        borderStyle: "rounded",
      });

      logger.break();
      logger.success(
        `Your CVM is being restarted. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`);
    } catch (error) {
      logger.error(`Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 