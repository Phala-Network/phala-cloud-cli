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
export const DEFAULT_VCPU = 2;
export const DEFAULT_MEMORY = 4096; // MB
export const DEFAULT_DISK_SIZE = 40; // GB

// Default TEEPod Image
export const DEFAULT_IMAGE = 'dstack-0.3.6';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  USER_INFO: '/api/v1/auth/me',

  // TEEPods
  TEEPODS: '/api/v1/teepods/available',
  TEEPOD_IMAGES: (teepodId: string) => `/api/v1/teepods/${teepodId}/images`,
  
  // CVMs
  CVMS: (userId: number) => `/api/v1/cvms?user_id=${userId}`,
  CVM_BY_APP_ID: (appId: string) => `/api/v1/cvms/app_${appId}`,
  CVM_NETWORK: (appId: string) => `/api/v1/cvms/app_${appId}/network`,
  CVM_START: (appId: string) => `/api/v1/cvms/app_${appId}/start`,
  CVM_STOP: (appId: string) => `/api/v1/cvms/app_${appId}/stop`,
  CVM_RESTART: (appId: string) => `/api/v1/cvms/app_${appId}/restart`,
  CVM_LOGS: (appId: string) => `/api/v1/cvms/app_${appId}/logs`,
  CVM_FROM_CONFIGURATION: '/api/v1/cvms/from_cvm_configuration',
  CVM_PUBKEY: '/api/v1/cvms/pubkey/from_cvm_configuration',
  CVM_UPGRADE: (appId: string) => `/api/v1/cvms/app_${appId}/compose`,
  CVM_ATTESTATION: (appId: string) => `/api/v1/cvms/app_${appId}/attestation`,
  CVM_RESIZE: (appId: string) => `/api/v1/cvms/app_${appId}/resources`,
  CVM_COMPOSE: (cvmId: string) => `/api/v1/cvms/${cvmId}/compose`,
  REPLICATE_CVM: (appId: string) => `/api/v1/cvms/${appId}/replicas`,
};

export const DOCKER_COMPOSE_ELIZA_V2_TEMPLATE = `version: '3.8'
services:
  postgres:
    image: ankane/pgvector:latest
    environment:
        - POSTGRES_PASSWORD=postgres
        - POSTGRES_USER=postgres
        - POSTGRES_DB=eliza
        - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
        - postgres-data:/var/lib/postgresql/data:rw
    ports:
        - '127.0.0.1:5432:5432'
    healthcheck:
        test: ['CMD-SHELL', 'pg_isready -U \$\${POSTGRES_USER} -d \$\${POSTGRES_DB}']
        interval: 5s
        timeout: 5s
        retries: 5
    restart: always
    networks:
      - eliza-network
  eliza:
    image: {{imageName}}
    command: bun run start
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    ports:
      - '3000:3000'
      - '50000-50100:50000-50100/udp'
    depends_on:
      postgres:
        condition: service_healthy
    restart: always
    networks:
      - eliza-network


networks:
  eliza-network:
    driver: bridge

volumes:
  postgres-data:`;

export const DOCKER_COMPOSE_BASIC_TEMPLATE = `version: '3.8'
services:
  app:
    image: {{imageName}}
    container_name: app
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    restart: always
`