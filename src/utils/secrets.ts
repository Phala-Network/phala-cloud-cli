import fs from 'node:fs';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

export const parseEnv = (envs: string[], envFile: string): EnvVar[] => {
    // Process environment variables
    const envVars: Record<string, string> = {};
    if (envs) {
        for (const env of envs) {
            if (env.includes("=")) {
                const [key, value] = env.split("=");
                if (key && value) {
                    envVars[key] = value;
                }
            }
        }
    }

    if (envFile) {
        const envFileContent = fs.readFileSync(envFile, "utf8");
        for (const line of envFileContent.split("\n")) {
            // Skip empty lines or comment lines
            if (!line.trim() || line.trim().startsWith('#')) continue;
            
            if (line.includes("=")) {
                // Split only on the first equals sign
                const [key, ...valueParts] = line.split("=");
                let value = valueParts.join("=");
                
                // Remove inline comments (anything after # with whitespace before it)
                const commentIndex = value.search(/\s+#/);
                if (commentIndex !== -1) {
                    value = value.substring(0, commentIndex).trim();
                }
                
                if (key && value) {
                    envVars[key.trim()] = value.trim();
                }
            }
        }
    }

    // Add environment variables to the payload
    return Object.entries(envVars).map(([key, value]) => ({
        key,
        value,
    }));
};