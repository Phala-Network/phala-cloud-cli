import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { logger } from './logger';

// Define the directory and file for storing configuration
const PHALA_CLOUD_DIR = path.join(os.homedir(), '.phala-cloud');
const CONFIG_FILE = path.join(PHALA_CLOUD_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  apiUrl: 'https://cloud-api.phala.network',
  cloudUrl: 'https://cloud.phala.network',
  defaultTeepodId: 3,
  defaultImage: 'dstack-dev-0.3.5',
  defaultVcpu: 1,
  defaultMemory: 2048,
  defaultDiskSize: 20,
};

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


import { join } from 'path';
function getConfigPath(): string {
  return join(process.cwd(), '.phala', 'config');
}
// Then update the functions to use fs methods:
function ensureConfigExists(): void {
  const configPath = getConfigPath();
  const configDir = join(process.cwd(), '.phala');
  
  fs.ensureDirSync(configDir);
  if (!fs.pathExistsSync(configPath)) {
    fs.writeJsonSync(configPath, {}, { spaces: 2 });
  }
}

function readConfig(): Record<string, any> {
  ensureConfigExists();
  return fs.readJsonSync(getConfigPath());
}

function writeConfig(config: Record<string, any>): void {
  ensureConfigExists();
  fs.writeJsonSync(getConfigPath(), config, { spaces: 2 });
}

export function saveCvmUuid(uuid: string): void {
  const config = readConfig();
  config.cvmUuid = uuid;
  writeConfig(config);
}

export function getCvmUuid(): string | undefined {
  // Check environment variable first
  if (process.env.PHALA_CLOUD_CVM_UUID) {
    return process.env.PHALA_CLOUD_CVM_UUID;
  }
  // Fall back to config file
  const config = readConfig();
  return config.cvmUuid;
}