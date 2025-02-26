import { apiClient } from './client';
import { API_ENDPOINTS } from '../utils/constants';
import { GetUserInfoResponse, getUserInfoResponseSchema } from './types';

/**
 * Get user information
 * @returns User information
 */
export async function getUserInfo(): Promise<GetUserInfoResponse> {
  try {
    const response = await apiClient.get<GetUserInfoResponse>(API_ENDPOINTS.USER_INFO);
    return getUserInfoResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate API key
 * @param apiKey API key to validate
 * @returns True if the API key is valid
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // Create a temporary client with the API key to validate
    const tempClient = apiClient;
    
    // Override the API key for this request
    const config = {
      headers: {
        'X-API-Key': apiKey
      }
    };
    
    // Try to get user info with the API key
    await tempClient.get(API_ENDPOINTS.USER_INFO, config);
    
    return true;
  } catch (error) {
    return false;
  }
} 