import { apiClient } from './client';
import { execSync } from 'child_process';
import { logger } from '@/src/utils/logger';
import { API_ENDPOINTS } from '@/src/utils/constants';
import { CvmComposeConfig, cvmComposeConfigSchema, kmsPubkeyResponseSchema, type KmsPubkeyResponse } from './types';
import { recoverSignerPublicKey } from '@/src/utils/signature';

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
