import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';

// Define the directory and file for storing configuration
const TEE_CLOUD_DIR = path.join(os.homedir(), '.tee-cloud');
const CONFIG_FILE = path.join(TEE_CLOUD_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  apiUrl: 'https://api.phala.cloud',
  cloudUrl: 'https://phala.cloud',
  defaultTeepodId: 3,
  defaultImage: 'dstack-dev-0.3.5',
  defaultVcpu: 1,
  defaultMemory: 2048,
  defaultDiskSize: 20,
};

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

// Load configuration
export function loadConfig(): Record<string, any> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
    }
    return DEFAULT_CONFIG;
  } catch (error) {
    logger.error('Failed to load configuration:', error);
    return DEFAULT_CONFIG;
  }
}

// Save configuration
export function saveConfig(config: Record<string, any>): void {
  ensureDirectoryExists();
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ ...loadConfig(), ...config }, null, 2),
      { mode: 0o600 } // Restrict permissions to user only
    );
    logger.success('Configuration saved successfully.');
  } catch (error) {
    logger.error('Failed to save configuration:', error);
    throw error;
  }
}

// Get a configuration value
export function getConfigValue(key: string): any {
  const config = loadConfig();
  return config[key];
}

// Set a configuration value
export function setConfigValue(key: string, value: any): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

// List all configuration values
export function listConfigValues(): Record<string, any> {
  return loadConfig();
} 