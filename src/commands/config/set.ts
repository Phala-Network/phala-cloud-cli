import { Command } from 'commander';
import { setConfigValue } from '../../utils/config';
import { logger } from '../../utils/logger';

export const setCommand = new Command()
  .name('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .action((key, value) => {
    try {
      // Try to parse the value as JSON if it looks like a JSON value
      let parsedValue = value;
      if (value.startsWith('{') || value.startsWith('[') || 
          value === 'true' || value === 'false' || 
          !isNaN(Number(value))) {
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // If parsing fails, use the original string value
        }
      }
      
      setConfigValue(key, parsedValue);
      logger.success(`Configuration value for '${key}' set successfully`);
    } catch (error) {
      logger.error(`Failed to set configuration value: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 