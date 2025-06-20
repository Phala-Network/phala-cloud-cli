# Phala Cloud CLI Commands

This document provides a comprehensive list of all commands and options available in the Phala Cloud CLI.

## Global Usage

```
phala [command] [subcommand] [options]
```

## Authentication Commands

### `phala auth`

Authenticate with Phala Cloud.

#### Subcommands:

- **`login [api-key]`**: Set the API key for authentication
  - If no API key is provided, you will be prompted to enter one

- **`logout`**: Remove the saved API key

- **`status`**: Check the current authentication status

## Docker Management

### `phala docker`

Login to Docker Hub and manage Docker images.

#### Subcommands:

- **`login`**: Login to Docker Hub
  
- **`build`**: Build a Docker image for TEE deployment
  - Options:
    - `-t, --tag <tag>`: Tag for the Docker image
    - `-f, --file <file>`: Path to Dockerfile (default: ./Dockerfile)
    - `--no-cache`: Build without using cache

- **`push`**: Push a Docker image to Docker Hub
  - Options:
    - `-t, --tag <tag>`: Tag for the Docker image to push

- **`generate`**: Generate Docker configuration files
  - Options:
    - `-t, --template <template>`: Template name
    - `-o, --output <output>`: Output directory

## Node Management

### `phala nodes`

List and manage TEE nodes. When run without subcommands, it will list all available worker nodes.

#### Usage:
```bash
phala nodes [command]
```

#### Commands:
- **`list`, `ls`**: List all available worker nodes and their details
  - Shows TEEPod IDs that can be used with the `replicate` command
  - Example: `phala nodes` or `phala nodes list` or `phala nodes ls`

#### Examples:
```bash
# List all available nodes
phala nodes

# Alternative ways to list nodes
phala nodes list
phala nodes ls
```

## Deployment Commands

### `phala deploy`

Deploy a new Confidential Virtual Machine (CVM) to Phala Cloud with optional on-chain KMS integration.

#### Options:

**Basic Configuration:**
- `-n, --name <name>`: Name of the CVM (3-20 chars, alphanumeric with underscores/hyphens)
- `-c, --compose <path>`: Path to Docker Compose file (default: looks for docker-compose.yml/yaml in current dir)
- `--vcpu <number>`: Number of vCPUs (default: 1)
- `--memory <number>`: Memory in MB (default: 2048)
- `--disk-size <number>`: Disk size in GB (default: 20)
- `--teepod-id <id>`: TEEPod ID to use (will prompt if not provided)
- `-e, --env-file <path>`: Path to environment file (default: looks for .env.production, .env.prod, .env)
- `--skip-env`: Skip environment variable prompt (use with caution)
- `--pre-launch-script <path>`: Path to pre-launch script to run before starting the CVM

**On-Chain KMS Configuration:**
- `--kms-id <id>`: KMS ID to use for on-chain key management
- `--custom-app-id <address>`: Use an existing AppAuth contract address
- `--private-key <key>`: Private key for on-chain operations (or set PRIVATE_KEY environment variable)

#### Environment Variables:
- `PRIVATE_KEY`: Can be used instead of `--private-key` flag

#### Examples:

```bash
# Basic deployment with interactive prompts (standard CVM without on-chain KMS)
phala deploy

# Deploy with on-chain KMS (will deploy a new AppAuth contract)
export PRIVATE_KEY=your_private_key_here
phala deploy --kms-id your_kms_id

# Use existing AppAuth contract with on-chain KMS (no private key needed)
phala deploy --kms-id your_kms_id --custom-app-id 0x1234...

# Full deployment with all options specified (new AppAuth contract)
phala deploy \
  --name my-app \
  --compose docker-compose.prod.yml \
  --env-file .env.prod \
  --vcpu 2 \
  --memory 4096 \
  --disk-size 50 \
  --kms-id your_kms_id \
  --private-key 0xabc123... \
  --pre-launch-script ./pre-launch.sh

# Standard deployment without on-chain KMS
phala deploy --name my-app --compose docker-compose.yml
```

#### Notes:
- When using `--kms-id`, the command will use on-chain KMS for key management
- **Important**: `--private-key` and `--custom-app-id` are mutually exclusive:
  - Use `--private-key` when you need to deploy a new AppAuth contract
  - Use `--custom-app-id` when using an existing AppAuth contract (no private key needed)
- Environment variables from the specified file will be automatically encrypted and made available to the CVM

## CVM Management

### `phala cvms`

Manage Phala Confidential Virtual Machines (CVMs).

#### Subcommands:

- **`list`**: List all CVMs
  
- **`get <id>`**: Get details of a specific CVM
  - Arguments:
    - `id`: ID of the CVM to get details for

- **`create`**: Create a new CVM. This is the first step for both standard and on-chain KMS CVMs.
  - Options:
    - `-n, --name <n>`: Name of the CVM
    - `-c, --compose <compose>`: Path to Docker Compose file
    - `--vcpu <vcpu>`: Number of vCPUs (default: depends on configuration)
    - `--memory <memory>`: Memory in MB (default: depends on configuration)
    - `--disk-size <diskSize>`: Disk size in GB (default: depends on configuration)
    - `--teepod-id <teepodId>`: TEEPod ID to use
    - `--image <image>`: Version of dstack image to use
    - `-e, --env-file <envFile>`: Path to environment file
    - `--skip-env`: Skip environment variable prompt
    - `--debug`: Enable debug mode
    - `--use-onchain-kms`: Flag to enable on-chain KMS integration.
    - `--allowed-envs <allowedEnvs>`: Allowed environment variables for the CVM.
    - `--kms-id <kmsId>`: KMS ID to use. If not provided, it will be selected from the list of available KMS instances.

- **`provision`**: (Advanced) Provision a CVM instance and link it to the on-chain KMS. This is the final step after deploying the AppAuth contract.
  - Options:
    - `--app-id <appId>`: App ID for the CVM (with 0x prefix for on-chain KMS)
    - `--compose-hash <composeHash>`: Compose hash for the CVM (SHA-256 hex string)
    - `--app-auth-contract-address <string>`: AppAuth contract address for on-chain KMS
    - `--kms-id <string>`: KMS ID for API-based public key retrieval
    - `--kms-node-url <string>`: KMS node URL for direct public key retrieval
    - `--deployer-address <deployerAddress>`: Deployer address for the CVM
    - `-e, --env-file <envFile>`: Path to environment file
    - `--skip-env`: Skip environment variable prompt

- **`upgrade [app-id]`**: Upgrade a CVM to a new version
  - Arguments:
    - `[app-id]`: CVM app ID to upgrade (will prompt for selection if not provided)
  - Options:
    - `-c, --compose <compose>`: Path to new Docker Compose file
    - `-e, --env-file <envFile>`: Path to new environment file (optional)
    - `--private-key <key>`: Private key for on-chain operations (or set PRIVATE_KEY environment variable)
    - `--debug`: Enable debug mode

    - Example:
    ```bash
    # Basic upgrade with new compose file
    PRIVATE_KEY=your_private_key_here phala cvms upgrade <app-id> --compose docker-compose.prod.yml
    
    # Upgrade with new compose file and environment variables and private key
    phala cvms upgrade <app-id> --compose docker-compose.prod.yml --env-file .env.prod --private-key $PRIVATE_KEY
    ```

- **`start <id>`**: Start a CVM
  - Arguments:
    - `id`: ID of the CVM to start

- **`stop <id>`**: Stop a CVM
  - Arguments:
    - `id`: ID of the CVM to stop

- **`restart <id>`**: Restart a CVM
  - Arguments:
    - `id`: ID of the CVM to restart

- **`attestation <id>`**: Get attestation report for a CVM
  - Arguments:
    - `id`: ID of the CVM to get attestation for
  - Options:
    - `-o, --output <file>`: Output file for the attestation report (default: stdout)

- **`delete <id>`**: Delete a CVM
  - Arguments:
    - `id`: ID of the CVM to delete
  - Options:
    - `-f, --force`: Force deletion without confirmation

- **`resize <id>`**: Resize a CVM's resources
  - Arguments:
    - `id`: ID of the CVM to resize
  - Options:
    - `--vcpu <vcpu>`: New number of vCPUs
    - `--memory <memory>`: New memory allocation in MB
    - `--disk-size <diskSize>`: New disk size in GB



- **`replicate <id>`**: Create a replica of an existing CVM
  - Arguments:
    - `id`: ID of the CVM to replicate (which can be found with `phala cvms ls`)
  - Options:
    - `--teepod-id <teepodId>`: TEEPod ID to use for the replica (optional, use `phala nodes list` to see available TEEPod IDs)
    - `-e, --env-file <envFile>`: Path to environment file for the replica (optional)
  - Example:
    ```bash
    # First, list available nodes to find a teepod-id
    phala nodes list
    
    # Then use the teepod-id to create a replica
    phala cvms replicate <cvm-id> --teepod-id <teepod-id>
    ```

## Simulator Commands

### `phala simulator`

TEE simulator commands.

#### Subcommands:

- **`start`**: Start the TEE simulator
  - Options:
    - `-p, --port <port>`: Port to bind the simulator to (default: 8000)

- **`stop`**: Stop the TEE simulator

## Examples

Here are some examples of how to use the Phala Cloud CLI:

```bash
# Login to Phala Cloud
phala auth login

# Create a new CVM
phala cvms create -n "my-cvm" -c ./docker-compose.yml

# List all CVMs
phala cvms list

# Start the TEE simulator
phala simulator start
