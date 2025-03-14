#!/usr/bin/env bun
import { Command } from "commander"
import { logo } from "./utils/banner"
import { authCommands } from "./commands/auth"
import { dockerCommands } from "./commands/docker"
import { simulatorCommands } from "./commands/simulator"
import { logger } from "./utils/logger"
import { cvmsCommand } from './commands/cvms'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Get the version from package.json
// Using process.cwd() to get the project root directory
const packageJsonPath = join(process.cwd(), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("phala")
    .alias("pha")
    .description(`${logo}\nPhala Cloud CLI - Manage your Phala Cloud Deployments`)
    .version(`${packageJson.version}`)
    .addCommand(authCommands)
    .addCommand(cvmsCommand)
    .addCommand(dockerCommands)
    .addCommand(simulatorCommands)

  program.parse(process.argv)
}

main().catch((error) => {
  logger.error("An error occurred:", error)
  process.exit(1)
})