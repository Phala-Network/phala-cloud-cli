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
  CVM_UPGRADE: (appId: string) => `/api/v1/cvms/app_${appId}/compose`,
  CVM_ATTESTATION: (appId: string) => `/api/v1/cvms/app_${appId}/attestation`,
  CVM_RESIZE: (appId: string) => `/api/v1/cvms/app_${appId}/resources`,
};

export const DOCKER_COMPOSE_ELIZA_V2_TEMPLATE = `version: '3'
services:
  postgres:
    image: postgres:15
    environment:
        - POSTGRES_PASSWORD=postgres
        - POSTGRES_USER=postgres
        - POSTGRES_DB=eliza
    volumes:
        - postgres-data:/var/lib/postgresql/data
    ports:
        - "127.0.0.1:5432:5432"
    healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 5s
        timeout: 5s
        retries: 5
    restart: always
  eliza:
    image: {{imageName}}:{{tag}}
    container_name: elizav2
    command: bun run start
    stdin_open: true
    tty: true
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    ports:
      - "3000:3000"
    restart: always

volumes:
  eliza:`;