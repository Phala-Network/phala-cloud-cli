import { Command } from 'commander';
import { checkCvmExists, getCvmAttestation, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import chalk from 'chalk';

export const attestationCommand = new Command()
  .name('attestation')
  .description('Get attestation information for a CVM')
  .argument('[app-id]', 'CVM app ID (will prompt for selection if not provided)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (appId?: string, options?: { json?: boolean }) => {
    try {
      if (!appId) {
        logger.info('No CVM specified, fetching available CVMs...');
        const selectedCvm = await selectCvm();
        if (!selectedCvm) {
          return;
        }
        appId = selectedCvm;
      } else {
        appId = await checkCvmExists(appId);
      }

      logger.info(`Fetching attestation information for CVM app_${appId}...`);
      const spinner = logger.startSpinner('Fetching attestation information');

      try {
        const attestationData = await getCvmAttestation(appId);
        spinner.stop(true);

        if (!attestationData || Object.keys(attestationData).length === 0) {
          logger.info('No attestation information found');
          return;
        }

        // If JSON output is requested, just print the raw response
        if (options?.json) {
          logger.info(JSON.stringify(attestationData, null, 2));
          return;
        }

        // Display the attestation summary
        logger.success('Attestation Summary:');
        const summaryData = {
          'Status': attestationData.is_online ? chalk.green('Online') : chalk.red('Offline'),
          'Public Access': attestationData.is_public ? chalk.green('Enabled') : chalk.yellow('Disabled'),
          'Error': attestationData.error || 'None',
          'Certificates': `${attestationData.app_certificates?.length || 0} found`
        };
        
        logger.keyValueTable(summaryData, {
          borderStyle: 'rounded'
        });

        // Display certificate information
        if (attestationData.app_certificates && attestationData.app_certificates.length > 0) {
          
          attestationData.app_certificates.forEach((cert, index) => {
            logger.success(`Certificate #${index + 1} (${cert.position_in_chain === 0 ? 'End Entity' : 'CA'}):`);
            
            const certData = {
              'Subject': `${cert.subject.common_name || 'Unknown'}${cert.subject.organization ? ` (${cert.subject.organization})` : ''}`,
              'Issuer': `${cert.issuer.common_name || 'Unknown'}${cert.issuer.organization ? ` (${cert.issuer.organization})` : ''}`,
              'Serial Number': cert.serial_number,
              'Validity': `${new Date(cert.not_before).toLocaleString()} to ${new Date(cert.not_after).toLocaleString()}`,
              'Fingerprint': cert.fingerprint,
              'Signature Algorithm': cert.signature_algorithm,
              'Is CA': cert.is_ca ? 'Yes' : 'No',
              'Position in Chain': cert.position_in_chain
            };
            
            logger.keyValueTable(certData, {
              borderStyle: 'single'
            });
            
            // Skip displaying the quote as it's very large and mostly binary data
          });
        }

        // Display TCB info if available
        if (attestationData.tcb_info) {
          logger.success('Trusted Computing Base (TCB) Information:');
          
          logger.keyValueTable(attestationData.tcb_info, {
            borderStyle: 'single'
          });
        }
      } catch (error) {
        spinner.stop(true);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to get attestation information: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
