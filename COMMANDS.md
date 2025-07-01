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
  - Shows Node IDs that can be used with the `deploy` or `replicate` commands
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
- `-c, --compose <path>`: Path to Docker Compose file
- `--vcpu <number>`: Number of vCPUs (default: 1)
- `--memory <memory>`: Memory with optional unit (e.g., 2G, 500MB), (default: 2048MB)
- `--disk-size <diskSize>`: Disk size with optional unit (e.g., 50G, 1T), (default: 20GB)
- `--node-id <nodeId>`: Node ID to use (will prompt if not provided)
- `-e, --env-file <envFile>`: Path to environment file
- `--image <image>`: Version of dstack image to use
- `--pre-launch-script <preLaunchScript>`: Path to pre-launch script to run before starting the CVM
- `-i, --interactive`: Enable interactive mode for required parameters

**On-Chain KMS Configuration:**
- `--kms-id <kmsId>`: KMS ID to use for on-chain key management
- `--custom-app-id <customAppId>`: Use an existing AppAuth contract address
- `--private-key <privateKey>`: Private key for on-chain operations (or set `PRIVATE_KEY` environment variable)
- `--rpc-url <rpcUrl>`: RPC URL for the blockchain

**Output Configuration:**
- `--json`: Output in JSON format (default: true)
- `--no-json`: Disable JSON output format
- `--debug`: Enable debug logging

#### Environment Variables:
- `PRIVATE_KEY`: Can be used instead of `--private-key` flag

#### Examples:

```bash
# Basic deployment with interactive prompts (standard CVM without on-chain KMS)
phala deploy --interactive

# Deploy with on-chain KMS (will deploy a new AppAuth contract)
export PRIVATE_KEY=your_private_key_here
phala deploy --name my-app --compose docker-compose.yml --kms-id your_kms_id

# Use an existing AppAuth contract with on-chain KMS (no private key needed)
phala deploy --name my-app --compose docker-compose.yml --kms-id your_kms_id --custom-app-id 0x1234...

# Full deployment with all options specified (new AppAuth contract)
phala deploy \
  --name my-cvm \
  --compose docker-compose.prod.yml \
  --env-file .env.prod \
  --vcpu 2 \
  --memory 4G \
  --disk-size 50G \
  --kms-id your_kms_id \
  --private-key 0xabc123... \
  --pre-launch-script ./pre-launch.sh
```

#### Notes:
- When using `--kms-id`, the command will use on-chain KMS for key management.
- **Important**: `--private-key` and `--custom-app-id` are mutually exclusive for AppAuth contract handling:
  - Use `--private-key` when you need to deploy a new AppAuth contract.
  - Use `--custom-app-id` when using an existing AppAuth contract (no private key needed for deployment).
- Environment variables from the specified file will be automatically encrypted and made available to the CVM.

## CVM Management

### `phala cvms`

Manage Phala Confidential Virtual Machines (CVMs).

#### Subcommands:

- **`list`, `ls`**: List all CVMs
  - Options:
    - `-j, --json`: Output in JSON format

- **`get <app-id>`**: Get details of a specific CVM
  - Arguments:
    - `app-id`: App ID of the CVM to get details for
  - Options:
    - `-j, --json`: Output in JSON format

- **`commit-provision <app-id> <compose-hash>`**: Provision a new CVM with on-chain KMS integration (two-phase commit)
  - Arguments:
    - `app-id`: App ID for the CVM (with 0x prefix for on-chain KMS)
    - `compose-hash`: Compose hash for the CVM (SHA-256 hex string)
  - Options:
    - `-i, --interactive`: Enable interactive mode for required parameters
    - `--kms-id <kmsId>`: KMS ID for API-based public key retrieval
    - `--deployer-address <deployerAddress>`: Deployer address for the CVM
    - `-e, --env-file <envFile>`: Path to environment file
    - `--debug`: Enable debug mode
    - `-c, --compose <compose>`: Path to Docker Compose file
    - `--rpc-url <rpcUrl>`: RPC URL for the blockchain
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output

- **`upgrade-commit <cvm-id> <compose-hash>`**: First phase of CVM upgrade with on-chain KMS integration
  - Arguments:
    - `cvm-id`: ID of the CVM to upgrade
    - `compose-hash`: Compose hash from the provision step
  - Options:
    - `-e, --env-file <envFile>`: Path to environment file
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output

- **`upgrade-provision <cvm-id>`**: Second phase of CVM upgrade with on-chain KMS integration
  - Arguments:
    - `cvm-id`: ID of the CVM to complete upgrade for
  - Options:
    - `-c, --compose <compose>`: Path to new Docker Compose file
    - `-e, --env-file <envFile>`: Path to environment file
    - `--debug`: Enable debug logging
    - `-i, --interactive`: Enable interactive mode
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output

- **`provision`**: (Advanced) Provision a new CVM, with optional on-chain KMS integration.
  - Options:
    - `-n, --name <name>`: Name of the CVM
    - `-c, --compose <compose>`: Path to Docker Compose file
    - `--vcpu <vcpu>`: Number of vCPUs
    - `--memory <memory>`: Memory with optional unit (e.g., 2G, 500MB)
    - `--disk-size <diskSize>`: Disk size with optional unit (e.g., 50G, 1T)
    - `--image <image>`: Version of dstack image to use
    - `--node-id <nodeId>`: Node ID to use
    - `-e, --env-file <envFile>`: Path to environment file
    - `-i, --interactive`: Enable interactive mode for required parameters
    - `--kms-id <kmsId>`: KMS ID to use
    - `--pre-launch-script <preLaunchScript>`: Path to pre-launch script
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output

- **`upgrade [app-id]`**: Upgrade a CVM to a new version
  - Arguments:
    - `[app-id]`: CVM app ID to upgrade (will prompt for selection if not provided)
  - Options:
    - `-c, --compose <compose>`: Path to new Docker Compose file
    - `-e, --env-file <envFile>`: Path to new environment file (optional)
    - `--private-key <privateKey>`: Private key for on-chain operations (or set `PRIVATE_KEY` environment variable)
    - `--debug`: Enable debug mode
    - `-i, --interactive`: Enable interactive mode for prompts
    - `--rpc-url <rpcUrl>`: RPC URL for the blockchain
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output

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



- **`replicate <cvm-id>`**: Create a replica of an existing CVM
  - Arguments:
    - `cvm-id`: UUID of the CVM to replicate (which can be found with `phala cvms ls`)
  - Options:
    - `--node-id <nodeId>`: Node ID to use for the replica (use `phala nodes list` to see available Node IDs)
    - `-e, --env-file <envFile>`: Path to environment file for the replica (optional)
    - `--json`: Output in JSON format
    - `--no-json`: Disable JSON output
  - Example:
    ```bash
    # First, list available nodes to find a node-id
    phala nodes list
    
    # Then use the node-id to create a replica
    phala cvms replicate <cvm-uuid> --node-id <node-id>
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

# Deploy a new CVM interactively
phala deploy --interactive

# List all CVMs
phala cvms list

# Start the TEE simulator
phala simulator start
```