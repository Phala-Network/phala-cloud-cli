
import { createClient } from '@phala/cloud'

const apiKey = process.env.PHALA_CLOUD_API_KEY;
if (!apiKey) {
    console.error(
        'API key is required. Please set it using: export PHALA_CLOUD_API_KEY=<your-api-key>',
    );
    process.exit(1);
}

export const apiClient = createClient({ apiKey });