#!/usr/bin/env node
import { Command } from "commander";
import { logo } from "./utils/banner";
import { initSentry, captureCommand } from './utils/sentry';
import { getCommandResult, getCommandError } from './utils/commander';
import { authCommands } from "./commands/auth";
import { dockerCommands } from "./commands/docker";
import { simulatorCommands } from "./commands/simulator";
import { logger } from "./utils/logger";
import { cvmsCommand } from "./commands/cvms";
import { demoCommands } from "./commands/demo";
import { nodesCommand } from "./commands/nodes";
import { deployCommand } from "./commands/deploy";
import { upgradeCommand } from "./commands/upgrade";
import { kmsCommands } from "./commands/kms";
import { setApiKey } from './utils/context';

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
  // Initialize Sentry before anything else
  await initSentry();
  
  const program = new Command()
    .name("phala")
    .alias("pha")
    .description(
      `${logo}\nPhala Cloud CLI - Manage your Phala Cloud Deployments`,
    )
    .version("v1.0.15")
    .option('--api-key <key>', 'API key to use for the command')
    .addCommand(authCommands)
    .addCommand(cvmsCommand)
    .addCommand(dockerCommands)
    .addCommand(simulatorCommands)
    .addCommand(demoCommands)
    .addCommand(nodesCommand)
    .addCommand(deployCommand)
    .addCommand(upgradeCommand)
    .addCommand(kmsCommands);

  // Set API key from command line
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.apiKey) {
      setApiKey(opts.apiKey);
    }
  });

  // Track command execution
  program.hook('postAction', (thisCommand, actionCommand) => {
    // Get the full command path
    const getCommandPath = (cmd: any): string => {
      if (!cmd.parent || cmd.parent.name() === 'phala' || cmd.parent.name() === '') {
        return cmd.name();
      }
      return `${getCommandPath(cmd.parent)} ${cmd.name()}`.trim();
    };
    
    const fullCommand = getCommandPath(actionCommand);
    
    // Define commands to exclude from telemetry
    const EXCLUDED_COMMANDS = ['simulator', 'docker', 'demo', 'auth', 'config'];
    const isExcluded = EXCLUDED_COMMANDS.some(cmd => fullCommand.startsWith(cmd));
    
    if (fullCommand && fullCommand !== 'phala' && !isExcluded) {
      const options = { ...actionCommand.opts() };
      
      // Check if the command has a result or error
      const error = getCommandError(actionCommand);
      const status = error ? 'error' : 'success';
      
      captureCommand(fullCommand, {
        ...options,
        ...(error && { 
          error: error.message,
          stack: error.stack 
        }),
        timestamp: new Date().toISOString()
      }, status);
    }
  });

  program.parse(process.argv);
}

main().catch((error) => {
  logger.error("An error occurred:", error);
});
