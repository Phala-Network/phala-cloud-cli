import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { logger } from './logger';
import { getApiKeyFromContext } from './context';

// Define the directory and file for storing credentials
const PHALA_CLOUD_DIR = path.join(os.homedir(), '.phala-cloud');
const API_KEY_FILE = path.join(PHALA_CLOUD_DIR, 'api-key');
const DOCKER_CREDENTIALS_FILE = path.join(PHALA_CLOUD_DIR, 'docker-credentials.json');

// Ensure the .phala-cloud directory exists
function ensureDirectoryExists(): void {
  if (!fs.existsSync(PHALA_CLOUD_DIR)) {
    try {
      fs.mkdirSync(PHALA_CLOUD_DIR, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${PHALA_CLOUD_DIR}:`, error);
      throw error;
    }
  }
}

// Generate a machine-specific encryption key
function getMachineKey(): Buffer {
  // Create a deterministic but machine-specific key
  const machineParts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
    os.userInfo().username
  ];
  
  // Create a hash of the machine parts
  const hash = crypto.createHash('sha256');
  hash.update(machineParts.join('|'));
  return hash.digest();
}

// Encrypt data
function encrypt(text: string): string {
  try {
    const key = getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key.slice(0, 32), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data
function decrypt(encryptedText: string): string {
  try {
    const key = getMachineKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

// API Key Management
export async function saveApiKey(apiKey: string): Promise<void> {
  ensureDirectoryExists();
  try {
    // Encrypt the API key before saving
    const encryptedApiKey = encrypt(apiKey);
    fs.writeFileSync(API_KEY_FILE, encryptedApiKey, { mode: 0o600 }); // Restrict permissions to user only
  } catch (error) {
    logger.error('Failed to save API key:', error);
    throw error;
  }
}

export async function getApiKey(): Promise<string | null> {
  // 1. Check context first (set by CLI flag)
  const apiKeyFromContext = getApiKeyFromContext();
  if (apiKeyFromContext) {
    return apiKeyFromContext;
  }

  // 2. Check environment variable
  const apiKeyFromEnv = process.env.PHALA_CLOUD_API_KEY;
  if (apiKeyFromEnv) {
    return apiKeyFromEnv;
  }

  // 3. Check stored API key file
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const encryptedApiKey = fs.readFileSync(API_KEY_FILE, 'utf8').trim();
      // Decrypt the API key
      return decrypt(encryptedApiKey);
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
    logger.success('Docker information saved successfully.');
  } catch (error) {
    logger.error('Failed to save Docker information:', error);
    throw error;
  }
}

export async function getDockerCredentials(): Promise<DockerCredentials | null> {
  try {
    if (fs.existsSync(DOCKER_CREDENTIALS_FILE)) {
      const data = fs.readFileSync(DOCKER_CREDENTIALS_FILE, 'utf8');
      const credentials = JSON.parse(data) as DockerCredentials;
      
      return credentials;
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