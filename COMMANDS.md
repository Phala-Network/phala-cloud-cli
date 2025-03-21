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

## CVM Management

### `phala cvms`

Manage Phala Confidential Virtual Machines (CVMs).

#### Subcommands:

- **`list`**: List all CVMs
  
- **`get <id>`**: Get details of a specific CVM
  - Arguments:
    - `id`: ID of the CVM to get details for

- **`create`**: Create a new CVM
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

- **`upgrade <id>`**: Upgrade a CVM
  - Arguments:
    - `id`: ID of the CVM to upgrade
  - Options:
    - `--image <image>`: New image version to upgrade to

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

## Simulator Commands

### `phala simulator`

TEE simulator commands.

#### Subcommands:

- **`start`**: Start the TEE simulator
  - Options:
    - `-t, --tag <tag>`: Tag for the simulator image
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

```