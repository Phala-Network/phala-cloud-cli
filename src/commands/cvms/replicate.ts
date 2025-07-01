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
    .option('--node-id <nodeId>', 'Node ID to use for the replica')
    .option('-e, --env-file <envFile>', 'Path to environment file')
    .option('--json', 'Output in JSON format (default: true)', true)
    .option('--no-json', 'Disable JSON output format')
    .option('--debug', 'Enable debug logging', false)
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

            if (options.nodeId) {
                requestBody.teepod_id = parseInt(options.nodeId, 10);
            }
            if (encryptedEnv) {
                requestBody.encrypted_env = encryptedEnv;
            }

            // Call the API to create the replica
            const replica = await replicateCvm(cvmId, requestBody);

            if (options.json !== false) {
                console.log(JSON.stringify({
                    success: true,
                    data: {
                        vm_uuid: replica.vm_uuid.replace(/-/g, ''),
                        app_id: replica.app_id,
                        name: replica.name,
                        status: replica.status,
                        node: {
                            id: replica.teepod_id,
                            name: replica.teepod?.name
                        },
                        vcpus: replica.vcpu,
                        memory_mb: replica.memory,
                        disk_size_gb: replica.disk_size,
                        app_url: replica.app_url || `${process.env.CLOUD_URL || 'https://cloud.phala.network'}/dashboard/cvms/${replica.vm_uuid.replace(/-/g, '')}`,
                        raw: replica
                    }
                }, null, 2));
            } else {
                logger.success(`Successfully created replica of CVM UUID: ${cvmId} with App ID: ${replica.app_id}`);

                const tableData = {
                    'CVM UUID': replica.vm_uuid.replace(/-/g, ''),
                    'App ID': replica.app_id,
                    'Name': replica.name,
                    'Status': replica.status,
                    'Node': `${replica.teepod?.name || 'N/A'} (ID: ${replica.teepod_id || 'N/A'})`,
                    'vCPUs': replica.vcpu,
                    'Memory': `${replica.memory} MB`,
                    'Disk Size': `${replica.disk_size} GB`,
                    'App URL': replica.app_url || `${process.env.CLOUD_URL || 'https://cloud.phala.network'}/dashboard/cvms/${replica.vm_uuid.replace(/-/g, '')}`
                };

                logger.keyValueTable(tableData, {
                    borderStyle: 'rounded'
                });
                logger.success(`Your CVM replica is being created. You can check its status with:\nphala cvms get ${replica.app_id}`);
            }
        } catch (error) {
            const errorMessage = `Failed to create CVM replica: ${error instanceof Error ? error.message : String(error)}`;
            if (options.json !== false) {
                console.error(JSON.stringify({
                    success: false,
                    error: errorMessage,
                    stack: options.debug && error instanceof Error ? error.stack : undefined
                }, null, 2));
            } else {
                logger.error(errorMessage);
            }
            process.exit(1);
        }
    });
