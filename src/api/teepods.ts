import { apiClient } from './client';
import { API_ENDPOINTS } from '../utils/constants';
import { TEEPod, Image, teepodSchema, imageSchema } from './types';
import { z } from 'zod';

/**
 * Get all TEEPods
 * @returns List of TEEPods
 */
export async function getTeepods(): Promise<TEEPod[]> {
  try {
    const response = await apiClient.get<TEEPod[]>(API_ENDPOINTS.TEEPODS);
    return z.array(teepodSchema).parse(response);
  } catch (error) {
    throw new Error(`Failed to get TEEPods: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get images for a TEEPod
 * @param teepodId TEEPod ID
 * @returns List of images
 */
export async function getTeepodImages(teepodId: string): Promise<Image[]> {
  try {
    const response = await apiClient.get<Image[]>(API_ENDPOINTS.TEEPOD_IMAGES(teepodId));
    return z.array(imageSchema).parse(response);
  } catch (error) {
    throw new Error(`Failed to get TEEPod images: ${error instanceof Error ? error.message : String(error)}`);
  }
} 