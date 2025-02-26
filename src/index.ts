#!/usr/bin/env bun
import { Command } from "commander"
import { logo } from "./utils/banner"
import { authCommands } from "./commands/auth"
import { teepodsCommands } from "./commands/teepods"
// import { deployCommands } from "./commands/deploy"
// import { buildCommands } from "./commands/build"
import { dockerCommands } from "./commands/docker"
import { simulatorCommands } from "./commands/simulator"
import { configCommands } from "./commands/config"
import { logger } from "./utils/logger"
import { cvmsCommand } from './commands/cvms'

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("teecloud")
    .description(`${logo}\nPhala TEE Cloud CLI - Manage your TEE Cloud Deployments`)
    .version("0.0.1")

  // Add command groups
  authCommands(program)
  teepodsCommands(program)
  // deployCommands(program)
  // buildCommands(program)
  dockerCommands(program)
  simulatorCommands(program)
  configCommands(program)
  program.addCommand(cvmsCommand)

  program.parse(process.argv)
}

main().catch((error) => {
  logger.error("An error occurred:", error)
  process.exit(1)
})