// API URLs
export const CLOUD_API_URL = process.env.CLOUD_API_URL || 'https://cloud-api.phala.network';
export const CLOUD_URL = process.env.CLOUD_URL || 'https://cloud.phala.network';

// CLI Version
export const CLI_VERSION = '0.0.1';

// Docker Hub API
export const DOCKER_HUB_API_URL = 'https://hub.docker.com/v2';

// TEE Simulator
export const TEE_SIMULATOR = 'phalanetwork/tappd-simulator:latest';

// Default resource configurations
export const DEFAULT_VCPU = 1;
export const DEFAULT_MEMORY = 2048; // MB
export const DEFAULT_DISK_SIZE = 20; // GB

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  USER_INFO: '/api/v1/auth/me',

  // Users
  SEARCH_USERS: (username:string) => `/api/v1/users/search?q=${username}`,

  // TEEPods
  TEEPODS: '/api/v1/teepods?enabled=true',
  TEEPOD_IMAGES: (teepodId: string) => `/api/v1/teepods/${teepodId}/images`,
  
  // CVMs
  CVMS: (userId: number) => `/api/v1/cvms?user_id=${userId}`,
  CVM_BY_APP_ID: (appId: string) => `/api/v1/cvms/app_${appId}`,
  CVM_START: (appId: string) => `/api/v1/cvms/app_${appId}/start`,
  CVM_STOP: (appId: string) => `/api/v1/cvms/app_${appId}/stop`,
  CVM_RESTART: (appId: string) => `/api/v1/cvms/app_${appId}/restart`,
  CVM_LOGS: (appId: string) => `/api/v1/cvms/app_${appId}/logs`,
  CVM_FROM_CONFIGURATION: '/api/v1/cvms/from_cvm_configuration',
  CVM_PUBKEY: '/api/v1/cvms/pubkey/from_cvm_configuration',
  CVM_UPGRADE: (appId: string) => `/api/v1/cvms/app_${appId}/upgrade`,
}; 