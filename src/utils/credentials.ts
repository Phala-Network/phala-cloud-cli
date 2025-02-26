import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';

// Define the directory and file for storing credentials
const TEE_CLOUD_DIR = path.join(os.homedir(), '.tee-cloud');
const API_KEY_FILE = path.join(TEE_CLOUD_DIR, 'api-key');
const DOCKER_CREDENTIALS_FILE = path.join(TEE_CLOUD_DIR, 'docker-credentials.json');

// Ensure the .tee-cloud directory exists
function ensureDirectoryExists(): void {
  if (!fs.existsSync(TEE_CLOUD_DIR)) {
    try {
      fs.mkdirSync(TEE_CLOUD_DIR, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${TEE_CLOUD_DIR}:`, error);
      throw error;
    }
  }
}

// API Key Management
export async function saveApiKey(apiKey: string): Promise<void> {
  ensureDirectoryExists();
  try {
    fs.writeFileSync(API_KEY_FILE, apiKey, { mode: 0o600 }); // Restrict permissions to user only
    logger.success('API key saved successfully.');
  } catch (error) {
    logger.error('Failed to save API key:', error);
    throw error;
  }
}

export async function getApiKey(): Promise<string | null> {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      return fs.readFileSync(API_KEY_FILE, 'utf8').trim();
    }
    return null;
  } catch (error) {
    logger.error('Failed to read API key:', error);
    return null;
  }
}

export async function removeApiKey(): Promise<void> {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      fs.unlinkSync(API_KEY_FILE);
      logger.success('API key removed successfully.');
    } else {
      logger.warn('No API key found to remove.');
    }
  } catch (error) {
    logger.error('Failed to remove API key:', error);
    throw error;
  }
}

// Docker Credentials Management
interface DockerCredentials {
  username: string;
  password: string;
  registry?: string;
}

export async function saveDockerCredentials(credentials: DockerCredentials): Promise<void> {
  ensureDirectoryExists();
  try {
    fs.writeFileSync(
      DOCKER_CREDENTIALS_FILE, 
      JSON.stringify(credentials, null, 2), 
      { mode: 0o600 } // Restrict permissions to user only
    );
    logger.success('Docker credentials saved successfully.');
  } catch (error) {
    logger.error('Failed to save Docker credentials:', error);
    throw error;
  }
}

export async function getDockerCredentials(): Promise<DockerCredentials | null> {
  try {
    if (fs.existsSync(DOCKER_CREDENTIALS_FILE)) {
      const data = fs.readFileSync(DOCKER_CREDENTIALS_FILE, 'utf8');
      return JSON.parse(data) as DockerCredentials;
    }
    return null;
  } catch (error) {
    logger.error('Failed to read Docker credentials:', error);
    return null;
  }
}

export async function removeDockerCredentials(): Promise<void> {
  try {
    if (fs.existsSync(DOCKER_CREDENTIALS_FILE)) {
      fs.unlinkSync(DOCKER_CREDENTIALS_FILE);
      logger.success('Docker credentials removed successfully.');
    } else {
      logger.warn('No Docker credentials found to remove.');
    }
  } catch (error) {
    logger.error('Failed to remove Docker credentials:', error);
    throw error;
  }
} 