// API URLs
export const CLOUD_API_URL = process.env.CLOUD_API_URL || 'https://api.phala.cloud';
export const CLOUD_URL = process.env.CLOUD_URL || 'https://phala.cloud';

// CLI Version
export const CLI_VERSION = '0.0.1';

// Docker Hub API
export const DOCKER_HUB_API_URL = 'https://hub.docker.com/v2';

// TEE Simulator
export const TEE_SIMULATOR = 'phalanetwork/phala-pruntime:latest';

// Default resource configurations
export const DEFAULT_VCPU = 1;
export const DEFAULT_MEMORY = 2048; // MB
export const DEFAULT_DISK_SIZE = 20; // GB

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  USER_INFO: '/api/user',
  
  // TEEPods
  TEEPODS: '/api/teepods',
  TEEPOD_IMAGES: (teepodId: string) => `/api/teepods/${teepodId}/images`,
  
  // CVMs
  CVMS: '/api/cvms',
  CVM_BY_APP_ID: (appId: string) => `/api/cvms/app_${appId}`,
  CVM_START: (appId: string) => `/api/cvms/app_${appId}/start`,
  CVM_STOP: (appId: string) => `/api/cvms/app_${appId}/stop`,
  CVM_RESTART: (appId: string) => `/api/cvms/app_${appId}/restart`,
  CVM_LOGS: (appId: string) => `/api/cvms/app_${appId}/logs`,
  CVM_PUBKEY: '/api/cvms/pubkey',
  CVM_UPGRADE: (appId: string) => `/api/cvms/app_${appId}/upgrade`,
}; 