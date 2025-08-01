import { defineConfig } from "tsup"
import { config } from 'dotenv';

// Load environment variables from .env file
config();

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/api/index.ts"],
  format: ["esm"],
  sourcemap: true,
  minify: true,
  target: "esnext",
  outDir: "dist",
  define: {
    'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
    'process.env.SENTRY_TRACES_SAMPLE_RATE': JSON.stringify(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  },
})
