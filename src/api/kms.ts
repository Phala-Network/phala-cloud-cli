import { apiClient } from './client';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../utils/constants';
import { CvmComposeConfig, cvmComposeConfigSchema, kmsPubkeyResponseSchema, type KmsPubkeyResponse } from './types';
import { recoverSignerPublicKey } from '@/src/utils/signature';
import { z } from 'zod';

// KMS List Types
export interface KmsListOptions {
  page?: number;
  pageSize?: number;
  isOnchain?: boolean;
}

export const kmsInstanceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  url: z.string(),
  version: z.string(),
  chain_id: z.number().nullable(),
  kms_contract_address: z.string(),
  gateway_app_id: z.string(),
});

// The API returns an array of KMS instances directly
export const kmsListResponseSchema = z.array(kmsInstanceSchema);

export type KmsInstance = z.infer<typeof kmsInstanceSchema>;
export type KmsListResponse = z.infer<typeof kmsListResponseSchema>;

export type KmsInfo = {
  id: string;
  slug: string;
  url: string;
  version: string;
  chain_id: number | null;
  kms_contract_address: string;
  gateway_app_id: string;
};

/**
 * Get public key from the KMS API for a given app ID.
 * @param kmsId The KMS ID.
 * @param appId The application ID.
 * @returns The public key and signature.
 * TODO: need to verify the response signature
 */
export async function getKmsPubkey(kmsId: string, appId: string): Promise<KmsPubkeyResponse> {
  try {
    const response = await apiClient.get<KmsPubkeyResponse>(
      API_ENDPOINTS.KMS_PUBKEY(kmsId, appId)
    );
    const parsedResponse = kmsPubkeyResponseSchema.parse(response);

    // const recoveredSigner = recoverSignerPublicKey(
    //   parsedResponse.public_key,
    //   parsedResponse.signature,
    //   appId
    // );

    // // Verify that the public key in the response is the same as the one recovered from the signature.
    // // This proves that the sender owns the private key for the given public key.
    // if (
    //   !recoveredSigner ||
    //   recoveredSigner.toLowerCase() !== parsedResponse.public_key.toLowerCase()
    // ) {
    //   throw new Error(
    //     'Signature verification failed: The public key in the response does not match the signer.'
    //   );
    // }

    // logger.info('KMS public key signature verified successfully.');
    return parsedResponse;
  } catch (error) {
    throw new Error(
      `Failed to get public key from KMS: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get KMS instance details by slug
 * @param slug The KMS instance slug
 * @returns KMS instance details
 */
export async function getKmsInfo(identifier: string): Promise<KmsInfo> {
  try {
    const response = await apiClient.get<KmsInfo>(API_ENDPOINTS.KMS_INFO(identifier));
    return response;
  } catch (error) {
    throw new Error(
      `Failed to get KMS info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * List KMS instances with optional filtering
 */
export async function listKmsInstances(options: KmsListOptions = {}): Promise<KmsInstance[]> {
  try {
    const response = await apiClient.get<KmsInstance[]>(
      API_ENDPOINTS.KMS_LIST(options.page, options.pageSize, options.isOnchain)
    );
    
    // The API returns an array directly, so we parse it as is
    return kmsListResponseSchema.parse(response);
  } catch (error) {
    throw new Error(
      `Failed to list KMS instances: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get public key directly from KMS node for a given app ID using curl.
 * This is the default method when a kmsId is not available.
 * @param appId The application ID.
 * @returns The public key and signature.
 * TODO: This API is wrong, need to be fixed
 */
export async function getKmsPubkeyDirectly(appId: string): Promise<KmsPubkeyResponse> {
  try {
    const response = await apiClient.get<CvmComposeConfig>(
      API_ENDPOINTS.CVM_COMPOSE(appId)
    );
    const parsedResponse = cvmComposeConfigSchema.parse(response);
    return {
      public_key: parsedResponse.env_pubkey,
      signature: '',
    };
  } catch (error) {
    logger.error(`Failed to get public key directly from KMS: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
