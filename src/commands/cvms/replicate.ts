import { Command } from 'commander';
import { replicateCvm, getCvmComposeConfig } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import { encryptEnvVars } from '@phala/dstack-sdk/encrypt-env-vars';
import fs from 'node:fs';
import path from 'node:path';

export const replicateCommand = new Command()
    .name('replicate')
    .description('Create a replica of an existing CVM')
    .argument('<cvm-id>', 'UUID of the CVM to replicate')
    .option('--teepod-id <teepodId>', 'TEEPod ID to use for the replica')
    .option('-e, --env-file <envFile>', 'Path to environment file')
    .action(async (cvmId, options) => {
        try {
            let encryptedEnv: string | undefined;
            cvmId = cvmId.replace(/-/g, '');

            // Handle environment variables if provided
            if (options.envFile) {
                const envPath = path.resolve(process.cwd(), options.envFile);
                if (!fs.existsSync(envPath)) {
                    throw new Error(`Environment file not found: ${envPath}`);
                }

                // Read and parse the environment file
                const envContent = fs.readFileSync(envPath, 'utf-8');
                const envVars = envContent
                    .split('\n')
                    .filter(line => line.trim() !== '' && !line.trim().startsWith('#'))
                    .map(line => {
                        const [key, ...value] = line.split('=');
                        return {
                            key: key.trim(),
                            value: value.join('=').trim()
                        };
                    });

                // Get CVM compose config which includes the public key
                const cvmConfig = await getCvmComposeConfig(cvmId);

                // Encrypt the environment variables
                logger.info('Encrypting environment variables...');
                const encryptedVars = await encryptEnvVars(
                    envVars,
                    cvmConfig.env_pubkey
                );
                encryptedEnv = encryptedVars;
            }

            // Prepare the request body
            const requestBody: {
                teepod_id?: number;
                encrypted_env?: string;
            } = {};

            if (options.teepodId) {
                requestBody.teepod_id = parseInt(options.teepodId, 10);
            }
            if (encryptedEnv) {
                requestBody.encrypted_env = encryptedEnv;
            }

            // Call the API to create the replica
            const replica = await replicateCvm(cvmId, requestBody);

            logger.success(`Successfully created replica of CVM UUID: ${cvmId} with App ID: ${replica.app_id}`);

            const tableData = {
                'CVM UUID': replica.vm_uuid.replace(/-/g, ''),
                'App ID': replica.app_id,
                'Name': replica.name,
                'Status': replica.status,
                'TEEPod': `${replica.teepod.name} (ID: ${replica.teepod_id})`,
                'vCPUs': replica.vcpu,
                'Memory': `${replica.memory} MB`,
                'Disk Size': `${replica.disk_size} GB`,
                'App URL': replica.app_url || `${process.env.CLOUD_URL || 'https://cloud.phala.network'}/dashboard/cvms/${replica.vm_uuid.replace(/-/g, '')}`
            };

            logger.keyValueTable(tableData, {
                borderStyle: 'rounded'
            });
            logger.success(`Your CVM replica is being created. You can check its status with:\nphala cvms get ${replica.app_id}`);
        } catch (error) {
            logger.error('Failed to create CVM replica:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });
