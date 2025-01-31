import { z } from 'zod';

export const CLI_VERSION = "0.1.0";
export const CLOUD_API_URL = "https://cloud-api.phala.network";
export const CLOUD_URL = "https://cloud.phala.network";
export const TEE_SIMULATOR = "phalanetwork/tappd-simulator:latest";
export const COMPOSE_FILES_DIR = ".tee-cloud/compose-files";

export const DOCKER_COMPOSE_ELIZA_V2_TEMPLATE = `version: '3'
services:
  eliza:
    image: {{imageName}}:{{tag}}
    container_name: eliza
    command: bun run dev
    stdin_open: true
    tty: true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    ports:
      - "3000:3000"
    restart: always

volumes:
  eliza:`;

export const DOCKER_COMPOSE_ELIZA_V1_TEMPLATE = `version: '3'
services:
  eliza:
    image: {{imageName}}:{{tag}}
    container_name: eliza
    command: pnpm run start --non-interactive
    stdin_open: true
    tty: true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - eliza:/app/packages/client-twitter/src/tweetcache
      - eliza:/app/db.sqlite
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    ports:
      - "3000:3000"
    restart: always

volumes:
  eliza:`;

export const BASIC_COMPOSE_TEMPLATE = `version: '3'
services:
  app:
    image: {{imageName}}:{{tag}}
    container_name: app
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
{{#each envVars}}      - {{{this}}}
{{/each}}
    restart: always
`

export const ComposeTemplateSchema = z.object({
    name: z.string(),
    description: z.string(),
    template: z.string()
});

export const ComposeTemplatesSchema = z.record(z.string(), ComposeTemplateSchema);

export type ComposeTemplate = z.infer<typeof ComposeTemplateSchema>;

export const COMPOSE_TEMPLATES = ComposeTemplatesSchema.parse({
    'eliza-v1': {
        name: 'Eliza V1',
        description: 'Classic Eliza template with character file embedding',
        template: DOCKER_COMPOSE_ELIZA_V1_TEMPLATE
    },
    'eliza-v2': {
        name: 'Eliza V2',
        description: 'Modern Eliza template with Bun runtime',
        template: DOCKER_COMPOSE_ELIZA_V2_TEMPLATE
    },
    'basic': {
        name: 'Basic',
        description: 'Basic template for an app',
        template: BASIC_COMPOSE_TEMPLATE
    }
});
