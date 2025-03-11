# Phala Cloud CLI

A command-line tool for managing Trusted Execution Environment (TEE) deployments on Phala Cloud, from local development to cloud deployment.

<p align="center">
  <img src="https://phala.network/images/logo-colored.svg" alt="Phala Network Logo" width="180"/>
</p>

<p align="center">
  <b>Secure. Confidential. Verifiable.</b>
</p>

## 📖 What is Phala Cloud?

Phala Cloud is a confidential cloud platform that enables developers to deploy applications in a Trusted Execution Environment (TEE) using the [Dstack SDK](https://github.com/Dstack-TEE/dstack). TEEs provide hardware-level isolation and encryption, ensuring your application's code and data remain completely private and secure—even from the infrastructure providers hosting them.

**Key Benefits:**

- **Confidentiality**: Your code and data remain encrypted in memory during execution
- **Integrity**: Hardware guarantees that your application runs unmodified
- **Attestation**: Remote attestation quote to prove that your docker app is running in a genuine TEE
- **Simplified Deployment**: The CLI handles the complexity of TEE deployment using the Phala Cloud API

## 🚀 Quick Start (5 Minutes)

1. **Install Prerequisites**:
   ```bash
   # Install Bun
   curl -fsSL https://bun.sh/install | bash
   
   # Verify Docker is installed
   docker --version
   ```

2. **Install TEE Cloud CLI**:

   Install via npm or use npx/bunx
   ```bash
   # Install the CLI globally
   npm install -g phala

   # Use npx/bunx
   npx phala help
   bunx phala help
   ```
   
   or clone git repository
   
   ```bash
   # Clone the repository
   git clone --recurse-submodules https://github.com/Phala-Network/phala-cloud-cli.git
   cd phala-cloud-cli

   # Install and build
   bun install
   bun run build

   # Phala CLI help menu
   phala help
   ```

3. **Sign Up and Get API Key**:
   
   To deploy applications to Phala Cloud, you'll need an API key:

   - Visit [Phala Cloud](https://cloud.phala.network/login) to log into your Phala Cloud account. If you do not have an account, register with this link with [PROMO_CODE](https://cloud.phala.network/register?invite=PHALACLI).
   - After logging in, navigate to the "API Keys" section in your profile
   - Create a new API key with an appropriate name (e.g., "CLI Access")
   - Copy the generated API key - you'll need it for authentication
   - You can verify your API key using:
     ```bash
     phala auth login [your-phala-cloud-api-key]
     phala auth status
     ```

4. **Deploy Your First Confidential App**:
   ```bash
   # Deploy the webshell Dstack example
   phala cvms create
   ```

   Provide a name and select from the drop down of examples

   ```bash
   # ? Enter a name for the CVM: webshell
   # ? Choose a Docker Compose example or enter a custom path:

   #  lightclient
   #   private-docker-image-deployment
   #   ❯ webshell
   #   custom-domain
   #   prelaunch-script
   #   timelock-nts
   #   ssh-over-tproxy
   #   Using example: webshell (~/phala-cloud-cli/examples/webshell/docker-compose.yaml)
   #   ✔ Enter number of vCPUs (default: 1): 1

   #   ✔ Enter memory in MB (default: 2048): 2048
   #   ✔ Enter disk size in GB (default: 20): 20
   #   ⟳ Fetching available TEEPods... ✓
   #   ? Select a TEEPod: (Use arrow keys)
   #   ❯ prod5 (online)
   #   prod2 (online)
   #   ℹ Selected TEEPod: prod5

   #   ✔ Select an image: dstack-dev-0.3.5
   #   ⟳ Getting public key from CVM... ✓
   #   ⟳ Encrypting environment variables... ✓
   #   ⟳ Creating CVM... ✓
   #   ✓ CVM created successfully
   #   ℹ CVM ID: 2755
   #   ℹ Name: webshell
   #   ℹ Status: creating
   #   ℹ App ID: e15c1a29a9dfb522da528464a8d5ce40ac28039f
   #   ℹ App URL: <https://cloud.phala.network/dashboard/cvms/app_e15c1a29a9dfb522da528464a8d5ce40ac28039f>
   #    ℹ
   #    ℹ Your CVM is being created. You can check its status with:
   #    ℹ phala cvms status e15c1a29a9dfb522da528464a8d5ce40ac28039f
   ```

   Now interact with your application in Phala Cloud by going to the url on port 7681 (Example of what a url at port 7681 would look like https://e15c1a29a9dfb522da528464a8d5ce40ac28039f-7681.dstack-prod5.phala.network)

5. **Check the CVM's Attestation**:
   ```bash
   phala cvms attestation

   # ℹ No CVM specified, fetching available CVMs...
   # ⟳ Fetching available CVMs... ✓
   # ✔ Select a CVM: testing (88721d1685bcd57166a8cbe957cd16f733b3da34) - Status: running
   # ℹ Fetching attestation information for CVM 88721d1685bcd57166a8cbe957cd16f733b3da34...
   # ⟳ Fetching attestation information... ✓
   # ✓ Attestation Summary:

   # or list the app-id
   phala cvms attestation 88721d1685bcd57166a8cbe957cd16f733b3da34
   ```


## 🏗️ Development Workflow

### 1️⃣ Local Development

Develop and test your application locally with the built-in TEE simulator:

```bash
# Start the TEE simulator
phala simulator start

# Build your Docker image
phala docker build --image my-tee-app --tag v1.0.0

# Create an environment file
echo "API_KEY=test-key" > .env
echo "DEBUG=true" >> .env

# Generate and run Docker Compose
phala docker build-compose --image my-tee-app --tag v1.0.0 --env-file ./.env
phala docker run -c ./phala-compose.yaml -e ./.env

```

### 2️⃣ Cloud Deployment

Deploy your application to Phala's decentralized TEE Cloud:

```bash
# Set your Phala Cloud API key
phala auth login

# Login to Docker and Push your image to Docker Hub
phala docker login
phala docker build --image my-tee-app --tag v1.0.0
phala docker push --image my-tee-app --tag v1.0.0

# Deploy to Phala Cloud
phala cvms create --name my-tee-app --compose ./docker-compose.yml --env-file ./.env

# Access your app via the provided URL
```

## 💼 Real-World Use Cases for Confidential Computing

### 🏦 Financial Services
- **Private Trading Algorithms**: Execute proprietary trading strategies without revealing algorithms
- **Secure Multi-Party Computation**: Perform financial calculations across organizations without exposing sensitive data
- **Compliant Data Processing**: Process regulated financial data with provable security guarantees

### 🏥 Healthcare
- **Medical Research**: Analyze sensitive patient data while preserving privacy
- **Drug Discovery**: Collaborate on pharmaceutical research without exposing intellectual property
- **Health Record Processing**: Process electronic health records with HIPAA-compliant confidentiality

### 🔐 Cybersecurity
- **Secure Key Management**: Generate and store cryptographic keys in hardware-protected environments
- **Threat Intelligence Sharing**: Share cyber threat data across organizations without exposing sensitive details
- **Password Verification**: Perform credential validation without exposing password databases

### 🏢 Enterprise Applications
- **Confidential Analytics**: Process sensitive business data without exposure to cloud providers
- **IP Protection**: Run proprietary algorithms and software while preventing reverse engineering
- **Secure Supply Chain**: Validate and process sensitive supply chain data across multiple organizations

### 🌐 Web3 and Blockchain
- **Private Smart Contracts**: Execute contracts with confidential logic and data
- **Decentralized Identity**: Process identity verification without exposing personal information
- **Trustless Oracles**: Provide verified external data to blockchain applications

## 🧩 Project Structure

The Phala Cloud CLI is organized around core workflows:

1. **Authentication**: Connect to your Phala Cloud account
2. **TEEPod Info**: Fetch information about TEEPods (TEEPods are where your docker apps deploy to)
3. **Docker Management**: Build and manage Docker images for TEE
4. **TEE Simulation**: Local development environment
5. **Cloud Deployment**: Deploy to production and manage TEE Cloud deployments

## 📚 Command Reference

The Phala Cloud CLI provides a comprehensive set of commands for managing your TEE deployments. Below is a detailed reference for each command category.

### Authentication Commands

Commands for managing authentication with the Phala Cloud API.

#### Login

```bash
phala auth login [options]
```

Set the API key for authentication with Phala Cloud. The API key is stored with encryption for enhanced security.

**Options:**

- `[api-key]`: Phala Cloud API key to set

**Example:**
```bash
phala auth login [your-phala-cloud-api-key]
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

> WTF is TEEPod?
> You can think of a TEEPod as the TEE server that the docker app with be hosted on. These TEEPods support published base images of the [Dstack Releases](https://github.com/Dstack-TEE/dstack/releases) which is the base image used to launch your Docker app. The Dstack base image is important as you can provide evidence to reproduce the RA Quote of your docker app deployment. More details on this later.

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
phala docker run [options]
```

Run a Docker Compose file locally for testing.

**Options:**
- `-c, --compose <compose>`: Path to Docker Compose file
- `-e, --env-file <envFile>`: Path to environment file

**Example:**
```bash
phala docker run --compose ./tee-compose.yaml --env-file ./.env
```

### TEE Simulator Commands

Commands for managing the local TEE simulator for development and testing.

#### Start Simulator

```bash
phala simulator start [options]
```

Start the TEE simulator locally for development and testing.

**Options:**

- `-i, --image <image>`: Simulator image (defaults to 'phalanetwork/tappd-simulator:latest')

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
- `--vcpu <vcpu>`: Number of vCPUs (default: 1)
- `--memory <memory>`: Memory in MB (default: 2048)
- `--disk-size <diskSize>`: Disk size in GB (default: 20)
- `--teepod-id <teepodId>`: TEEPod ID to launch the CVM to
- `--image <image>`: Version of dstack image to use (i.e. dstack-dev-0.3.5)
- `-e, --env-file <envFile>`: Environment variables in the form of KEY=VALUE
- `--skip-env`: Path to environment file (default: false)
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms create --name my-tee-app --compose ./docker-compose.yml --vcpu 2 --memory 4096 --diskSize 60 --teepod-id 3 --image dstack-dev-0.3.5 --env-file ./.env
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
- `--env-file <envFile>`: Path to environment file
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms upgrade app_123456 --compose ./new-docker-compose.yml --env-file ./.env
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
phala cvms start e15c1a29a9dfb522da528464a8d5ce40ac28039f
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
phala cvms stop e15c1a29a9dfb522da528464a8d5ce40ac28039f
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
phala cvms restart e15c1a29a9dfb522da528464a8d5ce40ac28039f
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
phala cvms delete e15c1a29a9dfb522da528464a8d5ce40ac28039f
phala cvms delete --force e15c1a29a9dfb522da528464a8d5ce40ac28039f
```

## 📋 Sample Applications

Explore these example applications to understand different use cases for TEE deployment:

- **[Timelock Encryption](./examples/timelock-nts/)**: Encrypt messages that can only be decrypted after a specified time
- **[Light Client](./examples/lightclient/)**: A lightweight blockchain client implementation
- **[SSH Over TEE Proxy](./examples/ssh-over-tproxy/)**: Secure SSH tunneling through a TEE
- **[Web Shell](./examples/webshell/)**: Browser-based secure terminal
- **[Custom Domain](./examples/custom-domain/)**: Deploy with your own domain name
- **[Private Docker Image](./examples/private-docker-image-deployment/)**: Deploy using private Docker registries

## 🛠️ Advanced Features

### Docker Compose Templates

> This feature is still being developed. Best to build your own docker-compose file for now.

(WIP) Choose from docker compose file for your application:

```bash
phala docker generate --image my-app --tag v1.0.0 --env
```

### Customizing Resource Allocation

Resize specific resources for your existing CVM:

```bash
phala cvms resize e15c1a29a9dfb522da528464a8d5ce40ac28039f --name resource-intensive-app --compose ./compose.yml \
  --vcpu 4 --memory 8192 --disk-size 50 -r true -y
```

### Environment Variables Management

```bash
# Using env file
phala cvms create --name env-app --compose ./compose.yml --env-file ./.env
```

## 🔒 Security

The TEE Cloud CLI employs several security measures:

1. **Encrypted Credentials**: API keys and Docker credentials are stored with encryption using a machine-specific key
2. **Restricted Permissions**: All credential files are stored with 0600 permissions (user-only access)
3. **No Validation Storage**: API keys are not validated during login, preventing unnecessary transmission
4. **Local Storage**: All credentials are stored locally in the `~/.phala-cloud/` directory

## 🔍 Troubleshooting

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

## 👥 Community & Support

- [Phala Network Discord](https://discord.gg/phala-network)
- [GitHub Issues](https://github.com/Phala-Network/phala-cloud-cli/issues)
- [Phala Documentation](https://docs.phala.network)

## 📝 License

Apache 2.0

## 🤝 Contributing

To contribute or run in development mode:
```bash
bun run src/index.ts
```

The project uses:

- [Dstack-TEE: Dstack](https://github.com/Dstack-TEE/dstack)
- Bun for runtime and package management
- TypeScript for type safety
- Commander.js for CLI interface
- Zod for runtime validation

We welcome contributions! Please see our [contributing guide](CONTRIBUTING.md) for details.
