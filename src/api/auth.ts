import { createClient } from '@phala/cloud';
import { API_ENDPOINTS } from '../utils/constants';
import { GetUserInfoResponse, getUserInfoResponseSchema } from './types';
import { logger } from '../utils/logger';

// Helper function to safely stringify objects that might contain cyclic references
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (error instanceof Error && error.message.includes('cyclic')) {
      return '[Cyclic Object]';
    }
    return String(obj);
  }
}

/**
 * Get user information
 * @returns User information
 */
export async function getUserInfo(apiKey?: string): Promise<GetUserInfoResponse> {
  try {
    logger.debug(`Fetching user info from ${API_ENDPOINTS.USER_INFO}`);
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<any>(API_ENDPOINTS.USER_INFO);
    logger.debug(`Received response: ${safeStringify(response)}`);
    
    // Try to parse the response with the schema
    try {
      return getUserInfoResponseSchema.parse(response);
    } catch (parseError) {
      logger.error(`Failed to parse user info response: ${parseError}`);
      logger.debug(`Response structure: ${safeStringify(response)}`);
      throw parseError;
    }
  } catch (error) {
    logger.error(`Failed to get user info: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : String(error)}`);
  }
}