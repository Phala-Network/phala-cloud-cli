#!/usr/bin/env bun
import { Command } from "commander"
import { logger } from "@/src/utils/logger"
import { join, dirname } from "path"
import { logo } from "@/src/utils/banner"
import { setApiKeyCommand, deployCommand, teepodsCommand, imagesCommand, upgradeCommand, buildCommand, buildComposeCommand, runLocalCommand, publishCommand, listTagsCommand, simulatorCommand, listCvmsCommand } from "@/src/commands"
process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

// Get the package root directory
const __dirname = dirname(process.cwd())

const packageRoot = join(__dirname, "tee-cloud-cli", "src")
console.log(packageRoot)
async function main() {


    const program = new Command()
        .name("teecloud")
        .description(`${logo}
Phala TEE Cloud CLI - Manage your TEE Cloud Deployments`)
        .version("0.0.1")

    program
        .addCommand(setApiKeyCommand)
        .addCommand(simulatorCommand)
        .addCommand(buildCommand)
        .addCommand(buildComposeCommand)
        .addCommand(runLocalCommand)
        .addCommand(publishCommand)
        .addCommand(deployCommand)
        .addCommand(upgradeCommand)
        .addCommand(listCvmsCommand)
        .addCommand(listTagsCommand)
        .addCommand(teepodsCommand)
        .addCommand(imagesCommand)

    program.parse(process.argv)
}

main().catch((error) => {
    logger.error("An error occurred:", error)
    process.exit(1)
})