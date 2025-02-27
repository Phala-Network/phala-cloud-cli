import { apiClient } from './client';
import { API_ENDPOINTS } from '../utils/constants';
import {
  CvmInstance,
  GetCvmByAppIdResponse,
  GetPubkeyFromCvmResponse,
  CreateCvmResponse,
  UpgradeCvmResponse,
  cvmInstanceSchema,
  getCvmByAppIdResponseSchema,
  getPubkeyFromCvmResponseSchema,
  createCvmResponseSchema,
  upgradeCvmResponseSchema,
  Env
} from './types';
import { z } from 'zod';
import * as crypto from 'crypto';
import { x25519 } from '@noble/curves/ed25519';
import { getUserInfo, searchUsers } from './auth';
/**
 * Get all CVMs for the current user
 * @returns List of CVMs
 */
export async function getCvms(): Promise<CvmInstance[]> {
  try {
    const userInfo = await getUserInfo();
    const searchUsersResponse = await searchUsers(userInfo.username);
    const response = await apiClient.get<CvmInstance[]>(API_ENDPOINTS.CVMS(searchUsersResponse.users[0].id));
    return z.array(cvmInstanceSchema).parse(response);
  } catch (error) {
    throw new Error(`Failed to get CVMs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a CVM by App ID
 * @param appId App ID
 * @returns CVM details
 */
export async function getCvmByAppId(appId: string): Promise<GetCvmByAppIdResponse> {
  try {
    const response = await apiClient.get<GetCvmByAppIdResponse>(API_ENDPOINTS.CVM_BY_APP_ID(appId));
    return getCvmByAppIdResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get CVM by App ID: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get public key from CVM
 * @param vmConfig VM configuration
 * @returns Public key
 */
export async function getPubkeyFromCvm(vmConfig: any): Promise<GetPubkeyFromCvmResponse> {
  try {
    const response = await apiClient.post<GetPubkeyFromCvmResponse>(API_ENDPOINTS.CVM_PUBKEY, vmConfig);
    return getPubkeyFromCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get pubkey from CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a new CVM
 * @param vmConfig VM configuration
 * @returns Created CVM details
 */
export async function createCvm(vmConfig: any): Promise<CreateCvmResponse> {
  try {
    const response = await apiClient.post<CreateCvmResponse>(API_ENDPOINTS.CVM_FROM_CONFIGURATION, vmConfig);
    return createCvmResponseSchema.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Schema validation error:', JSON.stringify(error.errors, null, 2));
      console.error('API response:', JSON.stringify(error.format(), null, 2));
      throw new Error(`Response validation failed: ${JSON.stringify(error.errors)}`);
    }
    throw new Error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get CVMs by user ID
 * @returns List of CVMs
 */
export async function getCvmsByUserId(): Promise<CvmInstance[]> {
  try {
    const userInfo = await getUserInfo();
    const searchUsersResponse = await searchUsers(userInfo.username);
    const response = await apiClient.get(API_ENDPOINTS.CVMS(searchUsersResponse.users[0].id));
    return response as CvmInstance[];
  } catch (error) {
    throw new Error(`Failed to get CVMs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function startCvm(appId: string): Promise<boolean> {
  try {
    await apiClient.post(API_ENDPOINTS.CVM_START(appId));
    return true;
  } catch (error) {
    throw new Error(`Failed to start CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stop a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function stopCvm(appId: string): Promise<boolean> {
  try {
    await apiClient.post(API_ENDPOINTS.CVM_STOP(appId));
    return true;
  } catch (error) {
    throw new Error(`Failed to stop CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Restart a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function restartCvm(appId: string): Promise<boolean> {
  try {
    await apiClient.post(API_ENDPOINTS.CVM_RESTART(appId));
    return true;
  } catch (error) {
    throw new Error(`Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Upgrade a CVM
 * @param appId App ID
 * @param vmConfig VM configuration
 * @returns Upgrade response
 */
export async function upgradeCvm(appId: string, vmConfig: any): Promise<UpgradeCvmResponse> {
  try {
    const response = await apiClient.post<UpgradeCvmResponse>(API_ENDPOINTS.CVM_UPGRADE(appId), vmConfig);
    return upgradeCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to upgrade CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get logs for a CVM
 * @param appId App ID
 * @returns Logs
 */
export async function getCvmLogs(appId: string): Promise<string> {
  try {
    const response = await apiClient.get(API_ENDPOINTS.CVM_LOGS(appId));
    return response as string;
  } catch (error) {
    throw new Error(`Failed to get logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}

/**
 * Helper function to convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt environment variables for CVM
 * @param secrets Environment variables
 * @param pubkey Public key
 * @returns Encrypted environment variables
 */
export async function encryptSecrets(secrets: Env[], pubkey: string): Promise<string> {
  const envsJson = JSON.stringify({ env: secrets });

  // Generate private key and derive public key
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);

  // Generate shared key
  const remotePubkey = hexToUint8Array(pubkey);
  const shared = x25519.getSharedSecret(privateKey, remotePubkey);

  // Import shared key for AES-GCM
  const importedShared = await crypto.subtle.importKey(
    'raw',
    shared,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );

  // Encrypt the data
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    importedShared,
    new TextEncoder().encode(envsJson),
  );

  // Combine all components
  const result = new Uint8Array(
    publicKey.length + iv.length + encrypted.byteLength,
  );

  result.set(publicKey);
  result.set(iv, publicKey.length);
  result.set(new Uint8Array(encrypted), publicKey.length + iv.length);

  return uint8ArrayToHex(result);
}

/**
 * Delete a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function deleteCvm(appId: string): Promise<boolean> {
  try {
    await apiClient.delete(API_ENDPOINTS.CVM_BY_APP_ID(appId));
    return true;
  } catch (error) {
    throw new Error(`Failed to delete CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update a CVM
 * @param updatePayload Update payload
 * @returns Updated CVM details
 */
export async function updateCvm(updatePayload: any): Promise<any> {
  try {
    const response = await apiClient.put(API_ENDPOINTS.CVM_BY_APP_ID(updatePayload.app_id), updatePayload);
    return response;
  } catch (error) {
    throw new Error(`Failed to update CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
} 