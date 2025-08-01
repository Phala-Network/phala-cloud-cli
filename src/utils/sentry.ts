
import { logger } from './logger';
// List of parameter keys that contain sensitive information
const SENSITIVE_PARAMS = [
  'privateKey', 'private-key', 'private_key',
  'secret', 'password', 'apiKey', 'api-key', 'api_key',
  'token', 'accessToken', 'access_token',
  'mnemonic', 'mnemonicPhrase', 'mnemonic_phrase',
  'rpcUrl', 'rpc-url', 'rpc_url'
];

let isInitialized = false;
let Sentry: any;
let sentryEnabled = true; // Default to enabled

// These values are replaced at build time
const SENTRY_CONFIG = {
  DSN: process.env.SENTRY_DSN,
  TRACES_SAMPLE_RATE: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
};

// Check if Sentry is enabled at runtime
// Returns true unless SENTRY_ENABLED is explicitly set to 'false'
function checkSentryEnabled(): boolean {
  return process.env.SENTRY_ENABLED !== 'false';
}

export async function initSentry() {
  // Check if Sentry is disabled via runtime environment variable
  sentryEnabled = checkSentryEnabled();
  if (!sentryEnabled) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Sentry is disabled by environment variable');
    }
    return;
  }

  // Skip if no DSN is provided
  if (!SENTRY_CONFIG.DSN) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Sentry DSN not configured, skipping initialization');
    }
    return;
  }

  try {
    if (typeof Bun !== 'undefined') {
      Sentry = await import('@sentry/bun');
    } else {
      Sentry = await import('@sentry/node');
    }
    const commonConfig = {
      dsn: SENTRY_CONFIG.DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: SENTRY_CONFIG.TRACES_SAMPLE_RATE,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'token', 'api-key'];
          sensitiveHeaders.forEach(header => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]';
            }
          });
        }
        return event;
      }
    };
    Sentry.init({
      ...commonConfig,
      integrations: [Sentry.httpIntegration()]
    });

    isInitialized = true;
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Check if Sentry is properly initialized
 */
export function isSentryInitialized(): boolean {
  // If Sentry is explicitly disabled, return false regardless of initialization state
  if (!sentryEnabled) return false;
  if (!Sentry || !isInitialized) return false;
  try {
    return !!Sentry.getClient?.();
  } catch {
    return false;
  }
}


/**
 * Safely capture command execution data
 * @param command Name of the command being executed
 * @param params Parameters passed to the command (will be filtered for sensitive data)
 */
export function captureCommand(command: string, params: Record<string, any> = {}, status: string) {
  // Early return if Sentry is not initialized or explicitly disabled
  if (!sentryEnabled || !isSentryInitialized()) return;
    // Filter sensitive parameters
    const safeParams = Object.entries(params).reduce((acc, [key, value]) => {
      const isSensitive = SENSITIVE_PARAMS.some(
        sensitiveKey => key.toLowerCase() === sensitiveKey.toLowerCase()
      );

      // Handle sensitive data
      if (isSensitive) {
        acc[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        // Don't log complex objects to avoid potential data leaks
        acc[key] = '[Object]';
      } else if (value && typeof value === 'string' && value.length > 100) {
        // Truncate long strings
        acc[key] = value.substring(0, 50) + '...';
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return Sentry.startSpan({
      op: 'command',
      name: `command:${command}`,
      attributes: {
        command,
        status,
        ...safeParams
      }
    }, (span) => {
      try {
        // Add breadcrumb for command execution
        Sentry.addBreadcrumb({
          category: 'command',
          message: `Command ${status}: ${command}`,
          level: 'info',
          data: safeParams
        });

        if (span) {
          // Set span attributes
          span.setAttribute('status', status);
          span.setAttribute('command', command);
          
          // Set the operation status
          if (status === 'success') {
            span.setStatus('ok');
          } else if (status === 'error') {
            span.setStatus('internal_error');
            const error = new Error(`Command failed: ${command}`);
            Sentry.captureException(error);
          }
        }

        return span;
      } catch (error) {
        logger.error('Failed to capture command:', error);
        if (span) {
          span.setStatus('internal_error');
        }
        return null;
      }
    });
}

export default Sentry;
