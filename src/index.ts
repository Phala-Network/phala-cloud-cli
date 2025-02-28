#!/usr/bin/env bun
import { Command } from "commander"
import { logo } from "./utils/banner"
import { authCommands } from "./commands/auth"
import { teepodsCommands } from "./commands/teepods"
import { dockerCommands } from "./commands/docker"
import { simulatorCommands } from "./commands/simulator"
import { configCommands } from "./commands/config"
import { logger } from "./utils/logger"
import { cvmsCommand } from './commands/cvms'

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("phala")
    .description(`${logo}\nPhala Cloud CLI - Manage your Phala Cloud Deployments`)
    .version("0.0.1")
    .addCommand(authCommands)
    .addCommand(teepodsCommands)
    .addCommand(dockerCommands)
    .addCommand(simulatorCommands)
    .addCommand(configCommands)
    .addCommand(cvmsCommand)

  program.parse(process.argv)
}

main().catch((error) => {
  logger.error("An error occurred:", error)
  process.exit(1)
})