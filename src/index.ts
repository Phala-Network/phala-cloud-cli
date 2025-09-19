#!/usr/bin/env node
import { Command } from "commander";
import { logo } from "./utils/banner";
import { authCommands } from "./commands/auth";
import { dockerCommands } from "./commands/docker";
import { simulatorCommands } from "./commands/simulator";
import { logger } from "./utils/logger";
import { cvmsCommand } from "./commands/cvms";
import { nodesCommand } from "./commands/nodes";
import { statusCommand } from "./commands/status";
import { deployCommand } from "./commands/deploy";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const version = `v${packageJson.version}`;

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
  const program = new Command()
			.name("phala")
			.alias("pha")
			.description(
				`${logo}\nPhala Cloud CLI - Manage your Phala Cloud Deployments`,
			)
			.version(version)
			.addCommand(statusCommand)
			.addCommand(authCommands)
			.addCommand(cvmsCommand)
			.addCommand(dockerCommands)
			.addCommand(simulatorCommands)
			.addCommand(nodesCommand)
			.addCommand(deployCommand);

	program.parse(process.argv);
}

main().catch((error) => {
	logger.error("An error occurred:", error);
	process.exit(1);
});
