import { createClient } from '@phala/cloud';
import { API_ENDPOINTS } from '../utils/constants';
import { TEEPod, Image, teepodSchema, imageSchema, TeepodResponse, teepodResponseSchema } from './types';
import { z } from 'zod';
import { getApiKey } from '@/src/utils/credentials';

/**
 * Get all TEEPods with their images
 * @returns List of TEEPods with embedded images
 */
export async function getTeepods(): Promise<TeepodResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await (await apiClient).get<TeepodResponse>(API_ENDPOINTS.TEEPODS);
    const parsedResponse = teepodResponseSchema.parse(response);
    return parsedResponse;
  } catch (error) {
    throw new Error(`Failed to get TEEPods: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get images for a TEEPod
 * This function is maintained for backwards compatibility.
 * Images are now included directly in the TEEPod response.
 * 
 * @param teepodId TEEPod ID
 * @returns List of images for the TEEPod
 */
export async function getTeepodImages(teepodId: string): Promise<Image[]> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    // First try to get TEEPod with embedded images
    const teepodsResponse = await getTeepods();
    const teepod = teepodsResponse.nodes.find(pod => pod.teepod_id === Number(teepodId));
    
    // If we found the TEEPod and it has images, return them
    if (teepod && teepod.images && teepod.images.length > 0) {
      return teepod.images;
    }
    
    // Fallback to the original implementation
    const response = await (await apiClient).get<Image[]>(API_ENDPOINTS.TEEPOD_IMAGES(teepodId));
    return z.array(imageSchema).parse(response);
  } catch (error) {
    throw new Error(`Failed to get TEEPod images: ${error instanceof Error ? error.message : String(error)}`);
  }
}