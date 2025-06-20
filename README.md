<h1 align="center">Phala Cloud CLI</h1>
<p align="center">
  <b>Secure. Confidential. Verifiable.</b>
</p>

A command-line tool for managing Trusted Execution Environment (TEE) deployments on Phala Cloud, from local development to cloud deployment.
___

<p align="center">
   <b>👥 Community & Support</b>

<div align="center">

[Phala Network Discord](https://discord.gg/phala-network) | [GitHub Issues](https://github.com/Phala-Network/phala-cloud-cli/issues) | [Phala Documentation](https://docs.phala.network)

</div>
</p>

## Usage

- [Dstack-TEE: Dstack](https://github.com/Dstack-TEE/dstack)
- Bun for runtime and package management
- TypeScript for type safety
- Commander.js for CLI interface
- Zod for runtime validation

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
   ```

   > **NOTE**
   >
   > You can use `npx` or `bunx` to call the `phala` command
   >
   > ```bash
   > # Use npx/bunx
   >
   > npx phala help
   > bunx phala help
   > ```
   
   ```bash
   # Phala CLI help menu
   npx phala help
   ```

3. **Sign Up and Get API Key**:
   
   To deploy applications to Phala Cloud, you'll need an API key:

   - Visit [Phala Cloud](https://cloud.phala.network/login) to log into your Phala Cloud account. If you do not have an account, registe [here](https://cloud.phala.network/register?invite=beta) or run `npx phala free` in the terminal.
   - After logging in, navigate to the "API Keys" section in your profile
   - Create a new API key with an appropriate name (e.g., "CLI Access")
   - Copy the generated API key - you'll need it for authentication
   - You can verify your API key using:
     ```bash
     phala auth login [your-phala-cloud-api-key]
     phala auth status
     ```

4. **Deploy Your First Confidential App**:
   Clone the [Dstack Examples](https://github.com/Dstack-TEE/dstack-examples) repo and cd into the webshell directory
   ```bash
   git clone https://github.com/Dstack-TEE/dstack-examples.git && cd dstack-examples/webshell
   ```
   
   ```bash
   # Deploy the webshell Dstack example
   phala cvms create
   ```

   Provide a name and select from the drop down of examples

   ```bash
   # ? Enter a name for the CVM: webshell
   # ℹ Detected docker compose file: ./docker-compose.yml

   # ? Enter the path to your Docker Compose file:(docker-compose.yml)
   #   ✔ Enter number of vCPUs (default: 1): 1

   #   ✔ Enter memory in MB (default: 2048): 2048
   #   ✔ Enter disk size in GB (default: 20): 20
   #   ⟳ Fetching available TEEPods... ✓
   #   ⟳ Getting public key from CVM... ✓
   #   ⟳ Encrypting environment variables... ✓
   #   ⟳ Creating CVM... ✓
   #   ✓ CVM created successfully
   #   ℹ CVM ID: 87a117814c8348dba6a51196d256b1fc
   #   ℹ Name: webshell
   #   ℹ Status: creating
   #   ℹ App ID: e15c1a29a9dfb522da528464a8d5ce40ac28039f
   #   ℹ Endpoint: https://cloud.phala.network/dashboard/cvms/87a117814c8348dba6a51196d256b1fc
   #    ℹ
   #    ℹ Your CVM is being created. You can check its status with:
   #    ℹ phala cvms status 87a117814c8348dba6a51196d256b1fc
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

### 3️⃣ Simplified Workflow: One-Step On-Chain KMS CVM Creation

Deploy new applications with the `deploy` command:

```bash
# Basic deployment with interactive prompts
phala deploy

# Deployment with private key from environment, assume user want to deploy the default AppAuth contract we provide
export PRIVATE_KEY=your_private_key_here
phala deploy --kms-id 0x1234...

# Deployment with custom-app-id, assume user already deployed the AppAuth contract onchain
phala deploy \
  --kms-id 0xabc123 \
  --custom-app-id 0x5678... \
  --pre-launch-script ./pre-launch.sh
```

### 4️⃣ Upgrade Existing Applications

Upgrade your deployed applications with new configurations:

```bash
# Basic upgrade with new compose file
phala cvms upgrade <app-id> --compose docker-compose.prod.yml

# Upgrade with new compose file and environment variables and private key
phala cvms upgrade <app-id> --compose docker-compose.prod.yml --env-file .env.prod --private-key $PRIVATE_KEY
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

#### Build Docker Compose File

```bash
phala docker generate [options]
```

Build a Docker Compose file for your TEE application.

**Options:**
- -i, --image <image>       Docker image name to use in the compose file
- -t, --tag <tag>           Docker image tag to use in the compose file
- -e, --env-file <envFile>  Path to environment variables file
- -o, --output <output>     Output path for generated docker-compose.yml
- --template <template>     Template to use for the generated docker-compose.yml
- --manual                  Skip automatic image detection and enter image/tag manually
- -h, --help                display help for command

**Example:**
```bash
phala docker generate --image my-tee-app --tag v1.0.0 --env-file ./.env
```

### TEE Simulator Commands

Commands for managing the local TEE simulator for development and testing.

#### Start Simulator

```bash
phala simulator start [options]
```

Start the TEE simulator locally for development and testing.

**Options:**

- `-p, --port <port>`: Port to bind the simulator to (default: 8000)

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

### Cloud Virtual Machine (CVM) Commands

Commands for managing Cloud Virtual Machines (CVMs) on Phala Cloud.

#### List CVMs

List all your CVMs:

```bash
phala cvms list
```

#### Manage TEE Nodes

List all available worker nodes to find TEEPod IDs for replication. You can use any of these commands to list nodes:

```bash
# List all available nodes (recommended)
phala nodes

# Alternative ways to list nodes
phala nodes list
phala nodes ls
```

This will show you all available TEEPod nodes along with their IDs, which you can use with the `replicate` command's `--teepod-id` option. The output includes node details such as ID, name, region, FMSPC, device ID, and available images.

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
- `--teepod-id <teepodId>`: TEEPod ID to launch the CVM to (default: 3)
- `--image <image>`: Version of dstack image to use (i.e. dstack-0.3.5)
- `-e, --env-file <envFile>`: Environment variables in the form of KEY=VALUE
- `--skip-env`: Path to environment file (default: false)
- `--debug`: Enable debug mode

**Example:**
```bash
phala cvms create --name my-tee-app --compose ./docker-compose.yml --vcpu 2 --memory 4096 --diskSize 60 --teepod-id 3 --image dstack-dev-0.3.5 --env-file ./.env
```

##### Using a Private Docker Registry

You can deploy images from a private Docker registry by setting the appropriate environment variables. Check the [docs](https://docs.phala.network/phala-cloud/create-cvm/create-with-private-docker-image#deploy-private-docker-image-with-cli) for more information.

##### 🔐 DockerHub:
Set these variables:
- `DSTACK_DOCKER_USERNAME` – Your DockerHub username *(required)*
- `DSTACK_DOCKER_PASSWORD` – Your DockerHub password or personal access token *(required)*
- `DSTACK_DOCKER_REGISTRY` – Registry URL (optional, defaults to DockerHub)

##### 🔐 AWS ECR:
Set these variables:
- `DSTACK_AWS_ACCESS_KEY_ID` – AWS access key *(required)*
- `DSTACK_AWS_SECRET_ACCESS_KEY` – AWS secret key *(required)*
- `DSTACK_AWS_REGION` – AWS region of the ECR *(required)*
- `DSTACK_AWS_ECR_REGISTRY` – Full ECR registry URL *(required)*

Once set, the CLI will automatically authenticate and pull your private image securely.

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
phala cvms start [app-id]
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
phala cvms stop [app-id]
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
phala cvms restart [app-id]
```

Restart a CVM.

**Arguments:**
- `app-id`: App ID of the CVM to restart

**Example:**
```bash
phala cvms restart e15c1a29a9dfb522da528464a8d5ce40ac28039f
```

#### Replicate App

```bash
phala cvms replicate [options] <cvm-uuid>
```

Create a replica of an existing App using cvm-uuid. Before replicating, you can use `phala nodes` to find available TEEPod IDs.

**Basic Usage:**
```bash
phala cvms replicate <cvm-uuid>
```

**Options:**
- `--teepod-id <teepodId>`: TEEPod ID to use for the replica (use `phala nodes` to find available TEEPod IDs)
- `-e, --env-file <envFile>`: Path to environment file for the replica (will be encrypted with the original CVM's public key)

**Example Workflow:**
```bash
# List available nodes to find a teepod-id
phala nodes

# Create a replica using a specific teepod-id
phala cvms replicate <cvm-uuid> --teepod-id 123

# With environment variables
phala cvms replicate <cvm-uuid> -e .env
```

**Example:**
```bash
# Basic usage
phala cvms replicate e15c1a29a9dfb522da528464a8d5ce40ac28039f

# Specify a different TEEPod
phala cvms replicate e15c1a29a9dfb522da528464a8d5ce40ac28039f --teepod-id 123

# Use a different environment file
phala cvms replicate e15c1a29a9dfb522da528464a8d5ce40ac28039f -e .env.new
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

## 📝 License

Apache 2.0

## 🤝 Contributing

To contribute or run in development mode:
```bash
bun run src/index.ts
```
