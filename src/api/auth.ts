import { apiClient } from './client';
import { API_ENDPOINTS } from '../utils/constants';
import { GetUserInfoResponse, SearchUsersResponse, getUserInfoResponseSchema, searchUsersResponseSchema } from './types';
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
export async function getUserInfo(): Promise<GetUserInfoResponse> {
  try {
    logger.debug(`Fetching user info from ${API_ENDPOINTS.USER_INFO}`);
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

/**
 * Search for users by username
 * @param username Username to search for
 * @returns List of users matching the username
 */
export async function searchUsers(username: string): Promise<SearchUsersResponse> {
  try {
    logger.debug(`Searching for users with username: ${username}`);
    const response = await apiClient.get<any>(API_ENDPOINTS.SEARCH_USERS(username));
    logger.debug(`Received response: ${safeStringify(response)}`);
    
    // Try to parse the response with the schema
    try {
      return searchUsersResponseSchema.parse(response);
    } catch (parseError) {
      logger.error(`Failed to parse search users response: ${parseError}`);
      logger.debug(`Response structure: ${safeStringify(response)}`);
      throw parseError;
    }
  } catch (error) {
    logger.error(`Failed to search users: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to search users: ${error instanceof Error ? error.message : String(error)}`);
  }
}