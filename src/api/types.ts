import { z } from 'zod';

// Docker Config Schema
export const dockerConfigSchema = z.object({
  password: z.string(),
  registry: z.string().nullable(),
  username: z.string()
});

// Compose File Schema
export const composeFileSchema = z.object({
  docker_compose_file: z.string(),
  docker_config: dockerConfigSchema.optional(),
  features: z.array(z.string()),
  kms_enabled: z.boolean(),
  manifest_version: z.number(),
  name: z.string(),
  public_logs: z.boolean(),
  public_sysinfo: z.boolean(),
  runner: z.string().optional(),
  salt: z.string().nullable().optional(),
  tproxy_enabled: z.boolean(),
  version: z.string().optional()
});

// Configuration Schema
export const configurationSchema = z.object({
  name: z.string(),
  image: z.string(),
  compose_file: composeFileSchema,
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  ports: z.array(z.any())
});

// Hosted Schema
export const hostedSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  uptime: z.string(),
  app_url: z.string(),
  app_id: z.string(),
  instance_id: z.string(),
  configuration: configurationSchema,
  exited_at: z.string(),
  boot_progress: z.string(),
  boot_error: z.string(),
  shutdown_progress: z.string(),
  image_version: z.string()
});

// Managed User Schema
export const managedUserSchema = z.object({
  id: z.number(),
  username: z.string()
});

// Node Schema
export const nodeSchema = z.object({
  id: z.number(),
  name: z.string()
});

// CVM Instance Schema
export const cvmInstanceSchema = z.object({
  hosted: hostedSchema,
  name: z.string(),
  managed_user: managedUserSchema,
  node: nodeSchema,
  listed: z.boolean(),
  status: z.string(),
  in_progress: z.boolean(),
  dapp_dashboard_url: z.string(),
  syslog_endpoint: z.string(),
  allow_upgrade: z.boolean()
});

// Create CVM Response Schema
export const createCvmResponseSchema = z.object({
  app_id: z.string(),
  app_url: z.string()
});

// Get Pubkey From CVM Response Schema
export const getPubkeyFromCvmResponseSchema = z.object({
  app_env_encrypt_pubkey: z.string(),
  app_id_salt: z.string()
});

// Get CVM By App ID Response Schema
export const getCvmByAppIdResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  app_id: z.string(),
  app_url: z.string(),
  encrypted_env_pubkey: z.string(),
  status: z.string(),
  teepod_id: z.number(),
  image: z.string(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  compose_manifest: composeFileSchema,
  listed: z.boolean()
});

// Get User Info Response Schema
export const getUserInfoResponseSchema = z.object({
  username: z.string(),
  email: z.string(),
  credits: z.number(),
  role: z.string(),
  avatar: z.string(),
  flag_reset_password: z.boolean(),
  team_name: z.string(),
  team_tier: z.string(),
  trial_ended_at: z.string().nullable()
});

// Get CVMs By User ID Response Schema
export const getCvmsByUserIdResponseSchema = z.array(cvmInstanceSchema);

// Upgrade CVM Response Schema
export const upgradeCvmResponseSchema = z.object({
  detail: z.string()
});

// Encrypted Env Item Schema
export const encryptedEnvItemSchema = z.object({
  key: z.string(),
  value: z.string()
});

// TEEPod Schema
export const teepodSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string()
});

// Image Schema
export const imageSchema = z.object({
  name: z.string(),
  description: z.string().optional()
});

// Type exports
export type DockerConfig = z.infer<typeof dockerConfigSchema>;
export type ComposeFile = z.infer<typeof composeFileSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type Hosted = z.infer<typeof hostedSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type CvmInstance = z.infer<typeof cvmInstanceSchema>;
export type CreateCvmResponse = z.infer<typeof createCvmResponseSchema>;
export type GetPubkeyFromCvmResponse = z.infer<typeof getPubkeyFromCvmResponseSchema>;
export type GetCvmByAppIdResponse = z.infer<typeof getCvmByAppIdResponseSchema>;
export type GetUserInfoResponse = z.infer<typeof getUserInfoResponseSchema>;
export type GetCvmsByUserIdResponse = z.infer<typeof getCvmsByUserIdResponseSchema>;
export type UpgradeCvmResponse = z.infer<typeof upgradeCvmResponseSchema>;
export type EncryptedEnvItem = z.infer<typeof encryptedEnvItemSchema>;
export type TEEPod = z.infer<typeof teepodSchema>;
export type Image = z.infer<typeof imageSchema>;

// Environment variable type
export interface Env {
  key: string;
  value: string;
} 