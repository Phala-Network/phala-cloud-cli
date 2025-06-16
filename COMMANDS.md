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

## CVM Management

### `phala cvms`

Manage Phala Confidential Virtual Machines (CVMs).

#### Subcommands:

- **`list`**: List all CVMs
  
- **`get <id>`**: Get details of a specific CVM
  - Arguments:
    - `id`: ID of the CVM to get details for

- **`list-nodes`**: List all available worker nodes

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

- **`provision`**: Provision an on-chain KMS CVM. This is the final step after deploying the AppAuth contract.
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
    - `-e, --env-file <envFile>`: Path to environment file
    - `--debug`: Enable debug mode

- **`update [app-id]`**: Update a CVM's Docker Compose configuration.
  - Arguments:
    - `[app-id]`: CVM app ID to update (will prompt for selection if not provided)
  - Options:
    - `-c, --compose <compose>`: Path to new Docker Compose file
    - `-e, --env-file <envFile>`: Path to new environment file (optional)
    - `--debug`: Enable debug mode

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

## On-Chain KMS Management

### `phala kms`

Manage On-Chain Key Management Service (KMS) components.

#### Subcommands:

- **`deploy`**: Deploy or register an AppAuth contract for on-chain KMS. This command supports interactive prompts for all parameters if not provided as options.

  - **Options:**
    - `--kms-contract-address <kmsContractAddress>`: Address of the main KMS contract.
    - `--private-key <privateKey>`: Private key for signing transactions.
    - `--network <network>`: The network to deploy to (e.g., `hardhat`, `phala`, `sepolia`, `test`).
    - `--rpc-url <rpcUrl>`: The RPC URL for the blockchain (overrides network default).
    - `--app-auth-address <appAuthAddress>`: Register a pre-deployed AppAuth contract at this address.
    - `--app-auth-contract-path <appAuthContractPath>`: Path to a custom AppAuth contract file for deployment.
    - `--deployer-address <deployerAddress>`: Address of the owner for the new AppAuth instance (defaults to the wallet address).
    - `--initial-device-id <initialDeviceId>`: Initial device ID for the AppAuth contract (32-byte hex string with 0x prefix, e.g., 0x000...000).
    - `--compose-hash <composeHash>`: Initial compose hash for the AppAuth contract (32-byte hex string with 0x prefix, e.g., 0x000...000).

  When run without required options, the command will prompt for missing values interactively.

  **Example Workflows:**
  
  1. **Register an existing AppAuth contract:**
     ```bash
      phala kms deploy \
        --kms-contract-address 0x1234... \
        --app-auth-address 0xabcd... \
        --private-key your_private_key \
        --network phala
     ```

  2. **Deploy a default AppAuth contract (interactive):**
     ```bash
     phala kms deploy \
       --compose-hash sha256:...
     ```

  3. **Deploy with a custom AppAuth contract:**
     ```bash
      phala kms deploy \
        --kms-contract-address 0x1234... \
        --app-auth-contract-path ./path/to/custom/AppAuth.sol \
        --private-key your_private_key \
        --network phala \
        --deployer-address your_deployer_address \
        --initial-device-id 0x000...000 \
        --compose-hash sha256:...
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

# Create a CVM with on-chain KMS
phala cvms provision --app-id "0x..." --compose-hash "sha256:..." --app-auth-contract-address "0x..."
```