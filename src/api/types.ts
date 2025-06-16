import { z } from 'zod';
import { ZodDecimal as zodDecimal } from '../utils/types';
// Docker Config Schema
export const dockerConfigSchema = z.object({
  password: z.string(),
  registry: z.string().nullable(),
  username: z.string()
});

// Compose File Schema
export const composeFileSchema = z.object({
  docker_compose_file: z.string(),
  docker_config: dockerConfigSchema.optional().nullable(),
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
}).passthrough();

// Configuration Schema
export const configurationSchema = z.object({
  name: z.string(),
  image: z.string(),
  compose_file: composeFileSchema.nullable().optional(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  ports: z.array(z.any())
}).passthrough();

// Hosted Schema
export const hostedSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  uptime: z.string(),
  app_url: z.string().nullable(),
  app_id: z.string(),
  instance_id: z.string().nullable(),
  configuration: configurationSchema.nullable().optional(),
  exited_at: z.string().nullable(),
  boot_progress: z.string().nullable(),
  boot_error: z.string().nullable(),
  shutdown_progress: z.string().nullable(),
  image_version: z.string().nullable(),
}).passthrough();

// Managed User Schema
export const managedUserSchema = z.object({
  id: z.number(),
  username: z.string()
});

// Node Schema
export const nodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  region_identifier: z.string().optional(),
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
  dapp_dashboard_url: z.string().nullable(),
  syslog_endpoint: z.string(),
  allow_upgrade: z.boolean()
});

// POST request CVM Response Schema
export const postCvmResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  teepod_id: z.number().nullable(),
  teepod: z.object({
    id: z.number(),
    name: z.string()
  }).nullable(),
  user_id: z.number(),
  app_id: z.string(),
  vm_uuid: z.string().nullable(),
  instance_id: z.string().nullable(),
  app_url: z.string().nullable(),
  base_image: z.string(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  manifest_version: z.number(),
  version: z.string().nullable(),
  runner: z.string(),
  docker_compose_file: z.string(),
  features: z.array(z.string()).nullable(),
  created_at: z.string(),
  encrypted_env_pubkey: z.string(),
  device_id: z.string().optional(),
  kms_contract_address: z.string().optional(),
  kms_owner_address: z.string().optional(),
});

// Get Pubkey From CVM Response Schema
export const getPubkeyFromCvmResponseSchema = z.object({
  app_env_encrypt_pubkey: z.string(),
  app_id_salt: z.string()
});

// Get CVM By App ID Response Schema
export const getCvmByAppIdResponseSchema = z.object({
  id: z.number(),
  teepod_id: z.number().nullable(),
  teepod: z.object({
    id: z.number(),
    name: z.string()
  }).nullable(),
  name: z.string(),
  status: z.string(),
  in_progress: z.boolean(),
  app_id: z.string(),
  vm_uuid: z.string(),
  instance_id: z.string().nullable(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  base_image: z.string(),
  encrypted_env_pubkey: z.string(),
  listed: z.boolean(),
  project_id: z.string(),
  project_type: z.string().nullable(),
  compose_file: composeFileSchema.optional(),
  kms_info: z.any().optional(),
});

// Get User Info Response Schema
export const getUserInfoResponseSchema = z.object({
  username: z.string(),
  email: z.string(),
  credits: zodDecimal.create({ coerce: true }),
  granted_credits: zodDecimal.create({ coerce: true }),
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

// Returns null if successful, otherwise returns error message
const updatePatchCvmComposeErrorDetailSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
  type: z.string(),
});
export const updatePatchCvmComposeResponseSchema = z.union([
  z.null(),
  z.object({
    detail: z.array(updatePatchCvmComposeErrorDetailSchema),
  }),
]);

// Update CVM Compose Response Schema
export const updateCvmComposeResponseSchema = z.object({
  app_id: z.string(),
  device_id: z.string(),
  compose_hash: z.string(),
  kms_info: z.object({
    chain_id: z.number(),
    kms_url: z.string(),
    kms_contract_address: z.string(),
  }).optional(),
});

// Get CVM Compose File Response Schema
export const getCvmComposeFileResponseSchema = z.object({
  allowed_envs: z.array(z.string()),
  bash_script: z.string().nullable(),
  docker_compose_file: z.string(),
  kms_enabled: z.boolean(),
  local_key_provider_enabled: z.boolean(),
  manifest_version: z.number(),
  name: z.string(),
  no_instance_id: z.boolean(),
  pre_launch_script: z.string(),
  public_logs: z.boolean(),
  public_sysinfo: z.boolean(),
  runner: z.string(),
  salt: z.string().nullable(),
  tproxy_enabled: z.boolean(),
  gateway_enabled: z.boolean(),
  features: z.array(z.string()),
});

// Encrypted Env Item Schema
export const encryptedEnvItemSchema = z.object({
  key: z.string(),
  value: z.string()
});

// Image Schema
export const imageSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.array(z.number()).optional(),
  is_dev: z.boolean().optional(),
  os_image_hash: z.string().nullable().optional(),
  rootfs_hash: z.string().optional(),
  shared_ro: z.boolean().optional(),
  cmdline: z.string().optional(),
  kernel: z.string().optional(),
  initrd: z.string().optional(),
  hda: z.string().nullable().optional(),
  rootfs: z.string().optional(),
  bios: z.string().optional()
});

// TEEPod Schema with extended properties
export const teepodSchema = z.object({
  teepod_id: z.number().nullable(),
  id: z.number().optional(),
  name: z.string(),
  listed: z.boolean().optional(),
  resource_score: z.number().optional(),
  remaining_vcpu: z.number().optional(),
  remaining_memory: z.number().optional(),
  remaining_cvm_slots: z.number().optional(),
  images: z.array(imageSchema).optional(),
  region_identifier: z.string().optional(),
  dedicated_for_team_id: z.number().nullable().optional(),
  support_onchain_kms: z.boolean().optional(),
  fmspc: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
});

// Capacity Schema
export const capacitySchema = z.object({
  max_instances: z.number().nullable(),
  max_vcpu: z.number().nullable(),
  max_memory: z.number().nullable(),
  max_disk: z.number().nullable()
});

// KMS List Item Schema
export const kmsListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  url: z.string(),
  version: z.string(),
  chain_id: z.number(),
  kms_contract_address: z.string(),
  gateway_app_id: z.string().nullable().optional(),
});

// TeepodResponse Schema
export const teepodResponseSchema = z.object({
  tier: z.string(),
  capacity: capacitySchema,
  nodes: z.array(teepodSchema),
  kms_list: z.array(kmsListItemSchema).optional(),
});

// Get CVM Network Response Schema
export const getCvmNetworkResponseSchema = z.object({
  is_online: z.boolean(),
  is_public: z.boolean(),
  error: z.string().nullable(),
  internal_ip: z.string(),
  latest_handshake: z.string(),
  public_urls: z.array(z.object({
    app: z.string(),
    instance: z.string()
  })),
});



// KMS Pubkey Response Schema
export const kmsPubkeyResponseSchema = z.object({
  public_key: z.string(),
  signature: z.string(),
});

// Type exports


export type KmsPubkeyResponse = z.infer<typeof kmsPubkeyResponseSchema>;
export type KmsListItem = z.infer<typeof kmsListItemSchema>;
export type DockerConfig = z.infer<typeof dockerConfigSchema>;
export type ComposeFile = z.infer<typeof composeFileSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type Hosted = z.infer<typeof hostedSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type CvmInstance = z.infer<typeof cvmInstanceSchema>;
export type PostCvmResponse = z.infer<typeof postCvmResponseSchema>;
export type GetPubkeyFromCvmResponse = z.infer<typeof getPubkeyFromCvmResponseSchema>;
export type GetCvmByAppIdResponse = z.infer<typeof getCvmByAppIdResponseSchema>;
export type GetUserInfoResponse = z.infer<typeof getUserInfoResponseSchema>;
export type GetCvmsByUserIdResponse = z.infer<typeof getCvmsByUserIdResponseSchema>;
export type UpgradeCvmResponse = z.infer<typeof upgradeCvmResponseSchema>;
export type UpdateCvmComposeResponse = z.infer<typeof updateCvmComposeResponseSchema>;
export type UpdatePatchCvmComposeResponse = z.infer<typeof updatePatchCvmComposeResponseSchema>;
export type GetCvmComposeFileResponse = z.infer<typeof getCvmComposeFileResponseSchema>;
export type EncryptedEnvItem = z.infer<typeof encryptedEnvItemSchema>;
export type TEEPod = z.infer<typeof teepodSchema>;
export type Image = z.infer<typeof imageSchema>;
export type Capacity = z.infer<typeof capacitySchema>;
export type TeepodResponse = z.infer<typeof teepodResponseSchema>;
export type CvmAttestationResponse = z.infer<typeof cvmAttestationResponseSchema>;
export type GetCvmNetworkResponse = z.infer<typeof getCvmNetworkResponseSchema>;

// Provision CVM Response Schema
export const provisionCvmResponseSchema = z.object({
  app_id: z.string().nullable(),
  app_env_encrypt_pubkey: z.string(),
  compose_hash: z.string(),
  fmspc: z.string(),
  device_id: z.string(),
  os_image_hash: z.string(),
});

export type ProvisionCvmResponse = z.infer<typeof provisionCvmResponseSchema>;
/**
 * Certificate naming information
 */
export interface CertificateNameInfo {
  common_name: string | null;
  organization: string | null;
  country: string | null;
  state?: string | null;
  locality?: string | null;
}

/**
 * Certificate data structure
 */
export interface CertificateInfo {
  subject: CertificateNameInfo;
  issuer: CertificateNameInfo;
  serial_number: string;
  not_before: string;
  not_after: string;
  version: string;
  fingerprint: string;
  signature_algorithm: string;
  sans: string | null;
  is_ca: boolean;
  position_in_chain: number;
  quote: string | null;
}

/**
 * Event log entry
 */
export interface TCBEventLogEntry {
  imr: number;
  event_type: number;
  digest: string;
  event: string;
  event_payload: string;
}

/**
 * Trusted Computing Base (TCB) information
 */
export interface TCBInfo {
  mrtd: string;
  rootfs_hash: string;
  rtmr0: string;
  rtmr1: string;
  rtmr2: string;
  rtmr3: string;
  event_log: TCBEventLogEntry[];
}

// CVM Compose Configuration Schema
export const cvmComposeConfigSchema = z.object({
  compose_file: z.object({
    bash_script: z.string().nullable(),
    docker_compose_file: z.string(),
    docker_config: z.object({
      password: z.string(),
      registry: z.string().nullable(),
      username: z.string(),
    }),
    features: z.array(z.string()),
    kms_enabled: z.boolean(),
    manifest_version: z.number(),
    name: z.string(),
    pre_launch_script: z.string(),
    public_logs: z.boolean(),
    public_sysinfo: z.boolean(),
    runner: z.string(),
    salt: z.string(),
    tproxy_enabled: z.boolean(),
    version: z.string(),
  }),
  env_pubkey: z.string(),
  salt: z.string(),
});

export type CvmComposeConfig = z.infer<typeof cvmComposeConfigSchema>;

// Replicate CVM Response Schema
export const replicateCvmResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  teepod_id: z.number(),
  teepod: z.object({
    id: z.number(),
    name: z.string()
  }),
  user_id: z.number(),
  app_id: z.string(),
  vm_uuid: z.string(),
  instance_id: z.string().nullable(),
  app_url: z.string().nullable(),
  base_image: z.string(),
  vcpu: z.number(),
  memory: z.number(),
  disk_size: z.number(),
  manifest_version: z.number(),
  version: z.string().nullable(),
  runner: z.string(),
  docker_compose_file: z.string(),
  features: z.array(z.string()).nullable(),
  created_at: z.string(),
  encrypted_env_pubkey: z.string()
});

export type ReplicateCvmResponse = z.infer<typeof replicateCvmResponseSchema>;

export const cvmAttestationResponseSchema = z.object({
  is_online: z.boolean(),
  is_public: z.boolean(),
  error: z.string().nullable(),
  app_certificates: z.array(z.object({
    subject: z.object({
      common_name: z.string().nullable(),
      organization: z.string().nullable(),
      country: z.string().nullable(),
      state: z.string().nullable().optional(),
      locality: z.string().nullable().optional()
    }),
    issuer: z.object({
      common_name: z.string().nullable(),
      organization: z.string().nullable(),
      country: z.string().nullable()
    }),
    serial_number: z.string(),
    not_before: z.string(),
    not_after: z.string(),
    version: z.string(),
    fingerprint: z.string(),
    signature_algorithm: z.string(),
    sans: z.string().nullable(),
    is_ca: z.boolean(),
    position_in_chain: z.number(),
    quote: z.string().nullable()
  })).nullable(),
  tcb_info: z.object({
    mrtd: z.string(),
    rootfs_hash: z.string(),
    rtmr0: z.string(),
    rtmr1: z.string(),
    rtmr2: z.string(),
    rtmr3: z.string(),
    event_log: z.array(z.object({
      imr: z.number(),
      event_type: z.number(),
      digest: z.string(),
      event: z.string(),
      event_payload: z.string()
    }))
  }).nullable(),
  compose_file: z.string().nullable()
});