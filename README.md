# TEE Cloud CLI

A command-line tool for managing TEE deployments on Phala Network, from local development to cloud deployment.

## Prerequisites

- Docker installed and running
- [Bun](https://bun.sh) installed
- Docker Hub account for publishing images
- [Phala Cloud](https://cloud.phala.network/login) API key

## Installation

```bash
# Clone the repository
git clone https://github.com/Phala-Network/phala-cloud-cli.git
cd tee-cloud-cli

# Install dependencies
bun install

# Build and link the CLI
bun run build
```

After building, the CLI will be available as either `phala` command.

## Testing

The CLI includes end-to-end tests to ensure that all commands work correctly. To run the tests:

```bash
bun test
```

See the [test README](./test/README.md) for more information about the test structure and how to write tests.

## Command Reference

The TEE Cloud CLI provides a comprehensive set of commands for managing your TEE deployments. Below is a detailed reference for each command category.

### Authentication Commands

Commands for managing authentication with the Phala Cloud API.

#### Login

```bash
phala auth login [options]
```

Set the API key for authentication with Phala Cloud. The API key is stored with encryption for enhanced security.

**Options:**
- `-k, --key <key>`: API key to set (if not provided, you will be prompted)

**Example:**
```bash
phala auth login --key your-phala-cloud-api-key
```

#### Logout

```bash
phala auth logout
```

Remove the stored API key.

**Example:**
```bash
phala auth logout
```

#### Status

```bash
phala auth status [options]
```

Check your authentication status with Phala Cloud. Displays user information in a table format.

**Options:**
- `-j, --json`: Output in JSON format

**Example:**
```bash
phala auth status
phala auth status --json
```

### TEEPod Management Commands

Commands for managing TEEPods on Phala Cloud.

#### List TEEPods

```bash
phala teepods list
```

List all available TEEPods on Phala Cloud.

**Example:**
```bash
phala teepods list
```

#### List TEEPod Images

```bash
phala teepods images [options]
```

List available images for a specific TEEPod.

**Options:**
- `-t, --teepod-id <teepodId>`: TEEPod ID (required)

**Example:**
```bash
phala teepods images --teepod-id 2
```

### Docker Management Commands

Commands for managing Docker images for TEE deployments.

#### Docker Login

```bash
phala docker login [options]
```

Login to Docker Hub to enable pushing and pulling images.

**Options:**
- `-u, --username <username>`: Docker Hub username (if not provided, you will be prompted)
- `-p, --password <password>`: Docker Hub password (if not provided, you will be prompted)
- `-r, --registry <registry>`: Docker registry URL (optional, defaults to Docker Hub)

**Example:**
```bash
phala docker login --username your-dockerhub-username
```

#### Build Docker Image

```bash
phala docker build [options]
```

Build a Docker image for your TEE application.

**Options:**
- `-i, --image <image>`: Image name (required)
- `-t, --tag <tag>`: Image tag (required)
- `-f, --file <file>`: Path to Dockerfile (defaults to 'Dockerfile')

**Example:**
```bash
phala docker build --image my-tee-app --tag v1.0.0 --file ./Dockerfile
```

#### Push Docker Image

```bash
phala docker push [options]
```

Push a Docker image to Docker Hub.

**Options:**
- `-i, --image <image>`: Image name (required)
- `-t, --tag <tag>`: Image tag (required)

**Example:**
```bash
phala docker push --image my-tee-app --tag v1.0.0
```

#### List Docker Image Tags

```bash
phala docker tags [options]
```

List all tags for a Docker image on Docker Hub.

**Options:**
- `-i, --image <image>`: Image name (required)
- `-j, --json`: Output in JSON format

**Example:**
```bash
phala docker tags --image my-tee-app
```

#### Build Docker Compose File

```bash
phala docker build-compose [options]
```

Build a Docker Compose file for your TEE application.

**Options:**
- `-i, --image <image>`: Image name (required)
- `-t, --tag <tag>`: Image tag (required)
- `-u, --username <username>`: Docker Hub username
- `-e, --env-file <envFile>`: Path to environment file
- `-v, --version <version>`: Template version to use (basic, eliza-v1, eliza-v2)

**Example:**
```bash
phala docker build-compose --image my-tee-app --tag v1.0.0 --env-file ./.env
```

#### Run Local Docker Compose

```bash
phala docker run-local [options]
```

Run a Docker Compose file locally for testing.

**Options:**
- `-c, --compose <compose>`: Path to Docker Compose file
- `-e, --env-file <envFile>`: Path to environment file

**Example:**
```bash
phala docker run-local --compose ./tee-compose.yaml --env-file ./.env
```

### TEE Simulator Commands

Commands for managing the local TEE simulator for development and testing.

#### Start Simulator

```bash
phala simulator start [options]
```

Start the TEE simulator locally for development and testing.

**Options:**
- `-i, --image <image>`: Simulator image (defaults to 'phalanetwork/phala-pruntime:latest')

**Example:**
```bash
phala simulator start
```

#### Stop Simulator

```bash
phala simulator stop
```

Stop the running TEE simulator.

**Example:**
```bash
phala simulator stop
```

### Configuration Commands

Commands for managing CLI configuration settings.

#### Get Configuration Value

```bash
phala config get <key>
```

Get a specific configuration value.

**Arguments:**
- `key`: Configuration key to retrieve

**Example:**
```bash
phala config get apiUrl
```

#### Set Configuration Value

```bash
phala config set <key> <value>
```

Set a configuration value.

**Arguments:**
- `key`: Configuration key to set
- `value`: Value to set (can be a string, number, boolean, or JSON)

**Example:**
```bash
phala config set defaultVcpu 2
phala config set apiUrl "https://custom-api.phala.cloud"
phala config set debug true
phala config set customConfig '{"key": "value", "nested": {"array": [1, 2, 3]}}'
```

#### List Configuration Values

```bash
phala config list [options]
```

List all configuration values.

**Options:**
- `-j, --json`: Output in JSON format

**Example:**
```bash
phala config list
phala config list --json
```

### Cloud Virtual Machine (CVM) Commands

Commands for managing Cloud Virtual Machines (CVMs) on Phala Cloud.

#### List CVMs

```bash
phala cvms list [options]
```

List all CVMs associated with your account.

**Options:**
- `-j, --json`: Output in JSON format

**Example:**
```bash
phala cvms list
```

#### Get CVM Details

```bash
phala cvms get [options] <app-id>
```

Get detailed information about a specific CVM.

**Arguments:**
- `app-id`: App ID of the CVM

**Options:**
- `-j, --json`: Output in JSON format

**Example:**
```bash
phala cvms get app_123456
```

#### Create CVM

```bash
phala cvms create [options]
```

Create a new CVM on Phala Cloud.

**Options:**
- `-n, --name <name>`: Name of the CVM (required)
- `-c, --compose <compose>`: Path to Docker Compose file (required)
- `-t, --type <type>`: Type of CVM (default: 'phala')
- `-m, --mode <mode>`: Mode of operation (default: 'docker-compose')
- `--vcpu <vcpu>`: Number of vCPUs (default: 1)
- `--memory <memory>`: Memory in MB (default: 2048)
- `--disk-size <diskSize>`: Disk size in GB (default: 20)
- `-e, --env <env...>`: Environment variables in the form of KEY=VALUE
- `--env-file <envFile>`: Path to environment file
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms create --name my-tee-app --compose ./docker-compose.yml --vcpu 2 --memory 4096 --env-file ./.env
```

#### Update CVM

```bash
phala cvms update [options] <app-id>
```

Update an existing CVM.

**Arguments:**
- `app-id`: App ID of the CVM to update

**Options:**
- `-n, --name <name>`: New name for the CVM
- `-c, --compose <compose>`: Path to new Docker Compose file
- `--vcpu <vcpu>`: New number of vCPUs
- `--memory <memory>`: New memory in MB
- `--disk-size <diskSize>`: New disk size in GB
- `-e, --env <env...>`: Environment variables to add/update
- `--env-file <envFile>`: Path to environment file
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms update app_123456 --name updated-app-name --memory 4096
```

#### Upgrade CVM

```bash
phala cvms upgrade [options] <app-id>
```

Upgrade a CVM to a new version.

**Arguments:**
- `app-id`: App ID of the CVM to upgrade

**Options:**
- `-c, --compose <compose>`: Path to new Docker Compose file
- `-e, --env <env...>`: Environment variables to add/update
- `--env-file <envFile>`: Path to environment file
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms upgrade app_123456 --compose ./new-docker-compose.yml
```

#### Start CVM

```bash
phala cvms start <app-id>
```

Start a stopped CVM.

**Arguments:**
- `app-id`: App ID of the CVM to start

**Example:**
```bash
phala cvms start app_123456
```

#### Stop CVM

```bash
phala cvms stop <app-id>
```

Stop a running CVM.

**Arguments:**
- `app-id`: App ID of the CVM to stop

**Example:**
```bash
phala cvms stop app_123456
```

#### Restart CVM

```bash
phala cvms restart <app-id>
```

Restart a CVM.

**Arguments:**
- `app-id`: App ID of the CVM to restart

**Example:**
```bash
phala cvms restart app_123456
```

#### View CVM Logs

```bash
phala cvms logs [options] <app-id>
```

View logs for a CVM.

**Arguments:**
- `app-id`: App ID of the CVM

**Options:**
- `-f, --follow`: Follow log output (continuous updates)

**Example:**
```bash
phala cvms logs app_123456
phala cvms logs --follow app_123456
```

#### Delete CVM

```bash
phala cvms delete [options] <app-id>
```

Delete a CVM.

**Arguments:**
- `app-id`: App ID of the CVM to delete

**Options:**
- `-f, --force`: Skip confirmation prompt

**Example:**
```bash
phala cvms delete app_123456
phala cvms delete --force app_123456
```

## Local Development Workflow

### 1. Start the TEE Simulator

Test your application in a local TEE environment:

```bash
phala simulator start
```

The simulator will be available at http://localhost:8090.

### 2. Build Your Docker Image

```bash
phala docker build --image my-tee-app --tag v1.0.0
```

### 3. Test Locally

Generate a Docker Compose file for your application:

```bash
# First, create an environment file with your application's environment variables
echo "API_KEY=test-key" > .env
echo "DEBUG=true" >> .env

# Build a Docker Compose file using your image and environment file
phala docker build-compose --image my-tee-app --tag v1.0.0 --env-file ./.env
```

Run your application locally:

```bash
phala docker run-local --compose ./tee-compose.yaml --env-file ./.env
```

## Cloud Deployment Workflow

### 1. Configure API Key

```bash
phala auth login
```

### 2. Push Your Image to Docker Hub

```bash
# Login to Docker Hub
phala docker login

# Build your image
phala docker build --image my-tee-app --tag v1.0.0

# Push to Docker Hub
phala docker push --image my-tee-app --tag v1.0.0
```

### 3. Deploy to Phala Cloud

```bash
# Create a CVM with your application
phala cvms create --name my-tee-app --compose ./docker-compose.yml --env-file ./.env
```

## Examples

The repository includes example applications in the `examples/` directory:

- **lightclient**: A light client implementation
- **timelock-nts**: A timelock encryption system
- **ssh-over-tproxy**: SSH over TEE proxy
- **prelaunch-script**: Pre-launch script examples

These examples demonstrate different use cases and can be used as templates for your own applications.

## Docker Compose Templates

The CLI provides several templates for different use cases:

- `basic`: Simple template for general applications
- `eliza-v2`: Modern template with Bun runtime
- `eliza-v1`: Legacy template with character file support

## Configuration

The CLI stores configuration in `~/.tee-cloud/config.json`. Default configuration includes:

- `apiUrl`: API endpoint URL (default: 'https://api.phala.cloud')
- `cloudUrl`: Cloud dashboard URL (default: 'https://phala.cloud')
- `defaultTeepodId`: Default TEEPod ID (default: 3)
- `defaultImage`: Default image (default: 'dstack-dev-0.3.5')
- `defaultVcpu`: Default vCPU count (default: 1)
- `defaultMemory`: Default memory in MB (default: 2048)
- `defaultDiskSize`: Default disk size in GB (default: 20)

You can view and modify these settings using the `config` commands.

## Troubleshooting

Common issues and solutions:

1. **Docker Build Fails**
   - Verify Docker daemon is running
   - Check Dockerfile path
   - Ensure proper permissions

2. **Simulator Issues**
   - Check if port 8090 is available
   - Verify Docker permissions

3. **Cloud Deployment Fails**
   - Validate API key
   - Confirm image exists on Docker Hub
   - Check environment variables

For detailed help:
```bash
phala --help
phala <command> --help
```

## Development

To contribute or run in development mode:
```bash
bun run src/index.ts
```

The project uses:
- Bun for runtime and package management
- TypeScript for type safety
- Commander.js for CLI interface
- Zod for runtime validation

## License

TBD

## Security

The TEE Cloud CLI takes security seriously:

1. **Encrypted Credentials**: API keys and Docker credentials are stored with encryption using a machine-specific key.
2. **Restricted Permissions**: All credential files are stored with 0600 permissions (user-only access).
3. **No Validation Storage**: API keys are not validated during login, preventing unnecessary transmission of the key.
4. **Local Storage**: All credentials are stored locally in the `~/.tee-cloud/` directory.
