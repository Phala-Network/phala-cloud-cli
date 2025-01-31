import { Command } from "commander"
import { deploy, DeployOptions, images, teepods, upgrade, UpgradeOptions, Env, listCvms } from "@/src/tee";
import { writeApiKey } from "@/src/tee/credential";
import { DockerOperations } from "@/src/tee/docker";
import { TEE_SIMULATOR } from "@/src/tee/constants";
import fs from "fs";
import os from "os";

const parseEnv = (envs: string[], envFile: string): Env[] => {
    // Process environment variables
    const envVars: Record<string, string> = {};
    if (envs) {
        for (const env of envs) {
            if (env.includes("=")) {
                const [key, value] = env.split("=");
                if (key && value) {
                    envVars[key] = value;
                }
            }
        }
    }

    if (envFile) {
        const envFileContent = fs.readFileSync(envFile, "utf8");
        for (const line of envFileContent.split("\n")) {
            if (line.includes("=")) {
                const [key, value] = line.split("=");
                if (key && value) {
                    envVars[key] = value;
                }
            }
        }
    }

    // Add environment variables to the payload
    return Object.entries(envVars).map(([key, value]) => ({
        key,
        value,
    }));
};

const setApiKeyCommand = new Command()
    .command("set-apikey")
    .description("Set the X-API-Key for the TEE CLI")
    .argument("<apiKey>", "The API key to set")
    .action((apiKey: string) => {
        writeApiKey(apiKey);
    });

// Define the `deploy` command
const deployCommand = new Command()
    .command("deploy")
    .description("Deploy to TEE cloud")
    .option("-t, --type <type>", "Specify the TEE vendor type", "phala")
    .option(
        "-m, --mode <mode>",
        "Specify the deployment mode (e.g., docker file)",
        "docker-compose",
    )
    .option(
        "-n, --name <name>",
        "Specify the name of the docker image being deployed",
    )
    .option(
        "-c, --compose <compose>",
        "Specify the docker compose file to be deployed",
    )
    .option(
        "-e, --env <env...>",
        "Specify environment variables in the form of KEY=VALUE",
    )
    .option(
        "--env-file <envFile>",
        "Specify a file containing environment variables",
    )
    .option("--debug", "Enable debug mode to print more information", false)
    .action((options: DeployOptions) => {
        if (!options.type || options.type !== "phala") {
            console.error(
                "Error: The --type option is required. Currently only phala is supported.",
            );
            process.exit(1);
        }
        if (!options.mode || options.mode !== "docker-compose") {
            console.error(
                "Error: The --mode option is required. Currently only docker-compose is supported.",
            );
            process.exit(1);
        }
        if (!options.name) {
            console.error("Error: The --name option is required.");
            process.exit(1);
        }
        if (!options.compose) {
            console.error("Error: The --compose option is required.");
            process.exit(1);
        }

        // Process environment variables
        options.envs = parseEnv(options.env || [], options.envFile || "");

        deploy(options);
    });

const teepodsCommand = new Command()
    .command("teepods")
    .description("Query the teepods")
    .action(() => {
        teepods();
    });

const imagesCommand = new Command()
    .command("images")
    .description("Query the images")
    .option("--teepod-id <teepodId>", "Specify the id of the teepod")
    .action((options: { teepodId: string }) => {
        if (!options.teepodId) {
            console.error("Error: The --teepod-id option is required.");
            process.exit(1);
        }
        images(options.teepodId);
    });

const upgradeCommand = new Command()
    .command("upgrade")
    .description("Upgrade the TEE CLI")
    .option("-t, --type <type>", "Specify the TEE vendor type", "phala")
    .option(
        "-m, --mode <mode>",
        "Specify the deployment mode (e.g., docker file or other local testing deployments)",
        "docker-compose",
    )
    .option("--app-id <appId>", "Specify the app id")
    .option(
        "-e, --env <env...>",
        "Specify environment variables in the form of KEY=VALUE",
    )
    .option(
        "--env-file <envFile>",
        "Specify a file containing environment variables",
    )
    .option(
        "-c, --compose <compose>",
        "Specify the docker compose file to be deployed",
    )
    .action((options: UpgradeOptions) => {
        if (!options.compose) {
            console.error("Error: The --compose option is required.");
            process.exit(1);
        }

        // Process environment variables
        options.envs = parseEnv(options.env || [], options.envFile || "");

        upgrade(options);
    });

const buildCommand = new Command()
    .command("build")
    .description("Build the docker image")
    .requiredOption('-i, --image <name>', 'Docker image name')
    .requiredOption('-u, --username <name>', 'Docker Hub username')
    .requiredOption('-f, --dockerfile <path>', 'Path to Dockerfile')
    .requiredOption('-t, --tag <tag>', 'Tag for the Docker image')
    .action(async (options) => {
        const { image, dockerfile, tag, username } = options;
        const dockerOps = new DockerOperations(image, username);

        try {
            console.log(`Detected system architecture: ${os.arch()}`);
            await dockerOps.buildImage(dockerfile, tag);
        } catch (error) {
            console.error('Docker image build failed:', error);
            process.exit(1);
        }
    });

const buildComposeCommand = new Command()
    .command("build-compose")
    .description("Build a docker-compose file for a TEE application")
    .requiredOption('-i, --image <name>', 'Docker image name')
    .requiredOption('-u, --username <name>', 'Docker Hub username')
    .requiredOption('-t, --tag <tag>', 'Tag for the Docker image')
    .requiredOption('-e, --env-file <path>', 'Path to environment file')
    .option('-v, --version <version>', 'Version of docker compose template to use', 'basic')
    .action(async (options) => {
        const { image, username, tag, envFile, version } = options;
        const dockerOps = new DockerOperations(image, username);

        try {
            const composePath = await dockerOps.buildComposeFile(tag, envFile, version);
            console.log(`\nDocker compose file built successfully at: ${composePath}`);
            console.log('\nTo run this compose file, use:');
            console.log(`phala run-local --compose "${composePath}" --env-file "${envFile}"`);
        } catch (error) {
            console.error('Docker compose file build failed:', error);
            process.exit(1);
        }
    });

const runLocalCommand = new Command()
    .command("run-local")
    .description("Run a docker compose file locally")
    .requiredOption('-c, --compose <path>', 'Path to the docker-compose file')
    .requiredOption('-e, --env-file <path>', 'Path to environment file')
    .action(async (options) => {
        const { compose, envFile } = options;
        const dockerOps = new DockerOperations("dummy"); // image name not needed for running compose

        try {
            await dockerOps.runLocalCompose(compose, envFile);
        } catch (error) {
            console.error('Failed to run docker-compose:', error);
            process.exit(1);
        }
    });

const publishCommand = new Command()
    .command("publish")
    .description('Publish Docker image to Docker Hub')
    .requiredOption('-i, --image <name>', 'Docker image name')
    .requiredOption('-u, --username <name>', 'Docker Hub username')
    .requiredOption('-t, --tag <tag>', 'Tag of the Docker image to publish')
    .action(async (options) => {
        const { image, username, tag } = options;
        const dockerOps = new DockerOperations(image, username);

        try {
        await dockerOps.pushToDockerHub(tag);
        console.log(`Docker image ${image}:${tag} published to Docker Hub successfully.`);
        } catch (error) {
        console.error('Docker image publish failed:', error);
        process.exit(1);
        }
    });

const listTagsCommand = new Command()
    .command("list-tags")
    .description('List tags of a Docker image on Docker Hub')
    .requiredOption('-i, --image <name>', 'Docker image name')
    .requiredOption('-u, --username <name>', 'Docker Hub username')
    .action(async (options) => {
        const { image, username } = options;
        const dockerOps = new DockerOperations(image, username);

        try {
        const tags = await dockerOps.listPublishedTags();
        if (tags.length > 0) {
            console.log(`Tags for ${username}/${image}:`);
            tags.forEach(tag => console.log(`- ${tag}`));
        } else {
            console.log(`No tags found for ${username}/${image}`);
        }
        } catch (error) {
        console.error('Failed to list tags:', error);
        process.exit(1);
        }
    });

const simulatorCommand = new Command()
    .command("simulator")
    .description("Pull and run the latest TEE simulator locally")
    .action(async () => {
        const dockerOps = new DockerOperations("simulator");
        try {
            await dockerOps.runSimulator(TEE_SIMULATOR);
        } catch (error) {
            console.error('Failed to run simulator:', error);
            process.exit(1);
        }
    });


const listCvmsCommand = new Command()
    .command("list-cvms")
    .description("List all CVMs for the current user")
    .action(async () => {
        try {
            await listCvms();
        } catch (error) {
            console.error("Failed to list CVMs:", error);
            process.exit(1);
        }
    });

export {
    setApiKeyCommand,
    deployCommand,
    teepodsCommand,
    imagesCommand,
    upgradeCommand,
    buildCommand,
    buildComposeCommand,
    runLocalCommand,
    publishCommand,
    listTagsCommand,
    simulatorCommand,
    listCvmsCommand,
}