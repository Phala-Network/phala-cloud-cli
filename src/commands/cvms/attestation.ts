import { Command } from 'commander';
import { setCommandResult, setCommandError } from '@/src/utils/commander';
import { checkCvmExists, getCvmAttestation, selectCvm } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import chalk from 'chalk';
import type { CvmAttestationResponse } from '@/src/api/types';

export const attestationCommand = new Command()
  .name('attestation')
  .description('Get attestation information for a CVM')
  .argument('[app-id]', 'CVM app ID (will prompt for selection if not provided)')
  .option('-j, --json', 'Output in JSON format')
  .action(async function(this: Command, appId?: string, options?: { json?: boolean }) {
    try {
      let resolvedAppId: string;
      
      if (!appId) {
        logger.info('No CVM specified, fetching available CVMs...');
        const selectedCvm = await selectCvm();
        if (!selectedCvm) {
          setCommandResult(this, {
            success: false,
            error: 'No CVM selected',
            timestamp: new Date().toISOString()
          });
          return;
        }
        resolvedAppId = selectedCvm;
      } else {
        resolvedAppId = await checkCvmExists(appId);
      }

      const spinner = logger.startSpinner(`Fetching attestation information for CVM app_${resolvedAppId}...`);

      try {
        const attestationData: CvmAttestationResponse = await getCvmAttestation(resolvedAppId);
        spinner.stop(true);

        if (!attestationData || Object.keys(attestationData).length === 0) {
          const message = 'No attestation information found';
          setCommandResult(this, {
            success: false,
            error: message,
            appId: resolvedAppId,
            timestamp: new Date().toISOString()
          });
          logger.info(message);
          return;
        }

        // Set command result for telemetry
        setCommandResult(this, {
          success: true,
          appId: resolvedAppId,
          isOnline: attestationData.is_online,
          isPublic: attestationData.is_public,
          hasError: !!attestationData.error,
          certificateCount: attestationData.app_certificates?.length || 0,
          hasTcbInfo: !!attestationData.tcb_info,
          timestamp: new Date().toISOString()
        });

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
            logger.break();
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
              borderStyle: 'rounded'
            });
            
            // Skip displaying the quote as it's very large and mostly binary data
          });
        }

        // Display TCB info if available
        if (attestationData.tcb_info) {
          logger.break();
          logger.success('Trusted Computing Base (TCB) Information:');
          
          // Create a formatted version of the TCB info without the event log
          const tcbBasicInfo = {
            'Mrtd': attestationData.tcb_info.mrtd,
            'Rootfs Hash': attestationData.tcb_info.rootfs_hash,
            'Rtmr0': attestationData.tcb_info.rtmr0,
            'Rtmr1': attestationData.tcb_info.rtmr1,
            'Rtmr2': attestationData.tcb_info.rtmr2,
            'Rtmr3': attestationData.tcb_info.rtmr3,
            'Event Log Entries': `${attestationData.tcb_info.event_log.length} entries`
          };
          
          // Display basic TCB info
          logger.keyValueTable(tcbBasicInfo, {
            borderStyle: 'rounded'
          });
          
          // Display event log entries separately if they exist
          if (attestationData.tcb_info.event_log && attestationData.tcb_info.event_log.length > 0) {
            logger.break();
            logger.success('Event Log (Showing entries to reproduce RTMR3):');
            
            // Show the first 5 entries
            const maxEntriesToShow = 5;
            const entries = attestationData.tcb_info.event_log
              .filter(entry => entry.event !== null && entry.event !== "")
              .map((entry) => ({
                'Event': entry.event,
                'IMR': entry.imr.toString(),
                'Event Type': entry.event_type.toString(),
                'Payload': entry.event_payload,
              }));
            
            // Display entries in a table format
            logger.table(entries, [
              { key: "Event", header: "Event", minWidth: 8 },
              { key: "IMR", header: "IMR", minWidth: 3 },
              { key: "Event Type", header: "Type", minWidth: 8 },
              { key: "Payload", header: "Payload", minWidth: 25 },
            ]);
            
            if (attestationData.tcb_info.event_log.length > maxEntriesToShow) {
              logger.info('To see all full attestation data, use --json');
            }
            logger.break();
            logger.success('To reproduce RTMR3, use the tool at https://rtmr3-calculator.vercel.app/');
          }
        }
      } catch (error) {
        spinner.stop(false);
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCommandError(this, new Error(errorMessage));
      logger.error(`Failed to get attestation information: ${errorMessage}`);
      // Don't throw or exit to allow telemetry to be sent
      throw error;
    }
  });
