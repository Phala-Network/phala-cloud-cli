#!/usr/bin/env node
import { Command } from "commander";
import { logo } from "./utils/banner";
import { authCommands } from "./commands/auth";
import { dockerCommands } from "./commands/docker";
import { simulatorCommands } from "./commands/simulator";
import { logger } from "./utils/logger";
import { cvmsCommand } from "./commands/cvms";
import { joinCommand } from "./commands/join";
import { demoCommands } from "./commands/demo";
import { nodesCommand } from "./commands/nodes";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
  const program = new Command()
			.name("phala")
			.alias("pha")
			.description(
				`${logo}\nPhala Cloud CLI - Manage your Phala Cloud Deployments`,
			)
			.version("v1.0.15")
			.addCommand(authCommands)
			.addCommand(cvmsCommand)
			.addCommand(dockerCommands)
			.addCommand(simulatorCommands)
			.addCommand(demoCommands)
			.addCommand(joinCommand)
			.addCommand(nodesCommand);

	program.parse(process.argv);
}

main().catch((error) => {
	logger.error("An error occurred:", error);
	process.exit(1);
});
