import { apiClient } from './client';
import { execSync } from 'child_process';
import { logger } from '@/src/utils/logger';
import { API_ENDPOINTS } from '@/src/utils/constants';
import { kmsPubkeyResponseSchema } from './types';
import type { KmsPubkeyResponse } from './types';

/**
 * Get public key from the KMS API for a given app ID.
 * @param kmsId The KMS ID.
 * @param appId The application ID.
 * @returns The public key and signature.
 */
export async function getKmsPubkey(kmsId: string, appId: string): Promise<KmsPubkeyResponse> {
  try {
    const response = await apiClient.get<KmsPubkeyResponse>(API_ENDPOINTS.KMS_PUBKEY(kmsId, appId));
    return kmsPubkeyResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get public key from KMS: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get public key directly from KMS node for a given app ID using curl.
 * This is the default method when a kmsId is not available.
 * @param kmsNodeUrl The URL of the KMS node.
 * @param appId The application ID.
 * @returns The public key and signature.
 */
export async function getKmsPubkeyDirectly(kmsNodeUrl: string, appId: string): Promise<KmsPubkeyResponse> {
  try {
    // This simulates protobuf encoding for a message with a single string field (tag 1).
    const protoRequest = `1a${Buffer.from(appId).toString('hex')}`;
    logger.info(protoRequest);
    const command = `echo -n '${protoRequest}' | curl -s -X POST "${kmsNodeUrl}/prpc/KMS.GetAppEnvEncryptPubKey" -H "Content-Type: application/x-protobuf" --data-binary @-`;

    logger.info(`Executing curl command: ${command}`);
    logger.info(`Sending data: ${protoRequest}`);
    try {
      const stdoutBuffer = execSync(command, { input: protoRequest, stdio: 'pipe' });
      const stdoutHex = stdoutBuffer.toString('hex');
      logger.info(`Received response: ${stdoutHex}`);
      
      // This parsing is based on the previous implementation's assumption about the response structure.
      // It might need to be adjusted if the actual protobuf response is different.
      const publicKeyHex = `0x${stdoutHex.substring(2, 66)}`; // Assuming 32-byte key
      const signatureHex = `0x${stdoutHex.substring(68)}`; // Assuming the rest is the signature

      const response = {
        public_key: publicKeyHex,
        signature: signatureHex,
      };

      return kmsPubkeyResponseSchema.parse(response);
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        const stderr = (error as any).stderr.toString();
        logger.error(`Curl command stderr: ${stderr}`);
      }
      logger.error(`Curl command failed with error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to get public key directly from KMS: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
