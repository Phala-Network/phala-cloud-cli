import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from './logger';
import { DOCKER_COMPOSE_BASIC_TEMPLATE, DOCKER_COMPOSE_ELIZA_V2_TEMPLATE, DOCKER_HUB_API_URL } from './constants';
import { getDockerCredentials } from './credentials';
import Handlebars from 'handlebars';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { validateFileExists } from './prompts';
import { ComposeTemplateSchema } from './types';

const execAsync = promisify(exec);
const LOGS_DIR = '.phala-cloud/logs';
const COMPOSE_FILES_DIR = '.phala-cloud/compose';
const MAX_CONSOLE_LINES = 10;

export class DockerService {
  private username: string;
  private image: string;
  private registry: string;

  constructor(image: string, username?: string, registry?: string) {
    this.image = image;
    this.username = username || '';
    this.registry = registry || '';
  }

  private ensureLogsDir(): void {
    const logsPath = path.resolve(LOGS_DIR);
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }
  }

  private getLogFilePath(operation: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.resolve(LOGS_DIR, `${this.image}-${operation}-${timestamp}.log`);
  }

  private getSystemArchitecture(): string {
    const arch = os.arch();
    switch (arch) {
      case 'arm':
      case 'arm64':
        return 'arm64';
      case 'x64':
        return 'amd64';
      default:
        return arch;
    }
  }

  private spawnProcess(command: string, args: string[], operation: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      const logFile = this.getLogFilePath(operation);

      // Ensure logs directory exists before creating write stream
      this.ensureLogsDir();

      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      const consoleBuffer: string[] = [];

      const processOutput = (data: Buffer, isError: boolean = false) => {
        const lines = data.toString().split('\n');

        // Write to log file
        logStream.write(data);

        // Update console buffer
        lines.forEach(line => {
          if (line.trim()) {
            consoleBuffer.push(line);
            // Keep only the last MAX_CONSOLE_LINES lines
            if (consoleBuffer.length > MAX_CONSOLE_LINES) {
              consoleBuffer.shift();
            }

            // Clear console and print the buffer
            console.clear();
            console.log(`Latest ${MAX_CONSOLE_LINES} lines (full log at ${logFile}):`);
            console.log('-'.repeat(50));
            consoleBuffer.forEach(bufferedLine => {
              if (isError) {
                console.error(bufferedLine);
              } else {
                console.log(bufferedLine);
              }
            });
          }
        });
      };

      proc.stdout.on('data', (data) => processOutput(data));
      proc.stderr.on('data', (data) => processOutput(data, true));

      proc.on('close', (code) => {
        logStream.end();
        if (code === 0) {
          console.log(`\nOperation completed. Full log available at: ${logFile}`);
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}. Check log file: ${logFile}`));
        }
      });

      proc.on('error', (err) => {
        logStream.end();
        reject(err);
      });
    });
  }

  /**
   * Set Docker credentials
   * @param username Docker username
   * @param registry Docker registry
   */
  setCredentials(username: string, registry?: string): void {
    this.username = username;
    if (registry) {
      this.registry = registry;
    }
  }

  /**
   * Build a Docker image
   * @param dockerfile Path to Dockerfile
   * @param tag Tag for the image
   * @returns Success status
   */
  async buildImage(dockerfile: string, tag: string): Promise<boolean> {
    try {
      const arch = this.getSystemArchitecture();
      const fullImageName = `${this.username}/${this.image}:${tag}`;

      const spinner = logger.startSpinner(`Building Docker image ${this.username}/${this.image}:${tag}`);

      // Ensure the Dockerfile exists
      validateFileExists(dockerfile);

      const buildArgs = ['build', '-t', fullImageName, '-f', dockerfile];

      if (arch === 'arm64') {
        console.log('Detected arm64 architecture, using --platform linux/amd64');
        buildArgs.push('--platform', 'linux/amd64');
      }

      // Build the image
      buildArgs.push('.');

      await this.spawnProcess('docker', buildArgs, 'build');

      spinner.stop(true, `Docker image ${fullImageName} built successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to build Docker image: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Push a Docker image to Docker Hub
   * @param tag Tag for the image
   * @returns Success status
   */
  async pushImage(tag: string): Promise<boolean> {
    try {
      const spinner = logger.startSpinner(`Pushing Docker image ${this.username}/${this.image}:${tag} to Docker Hub`);

      // Check if user is logged in
      const credentials = await getDockerCredentials();
      if (!credentials) {
        spinner.stop(false);
        throw new Error('Docker credentials not found. Please log in first with "phala docker login"');
      }

      const fullImageName = `${this.username}/${this.image}:${tag}`;
      console.log(`Pushing image ${fullImageName} to Docker Hub...`);

      await this.spawnProcess('docker', ['push', fullImageName], 'push');

      spinner.stop(true, `Docker image ${fullImageName} pushed successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to push Docker image: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * List tags for a Docker image
   * @returns List of tags
   */
  async listTags(): Promise<string[]> {
    try {
      const spinner = logger.startSpinner(`Listing tags for ${this.username}/${this.image}`);

      // Get tags from Docker Hub API
      const response = await axios.get(`${DOCKER_HUB_API_URL}/repositories/${this.username}/${this.image}/tags`);

      if (!response.data || !response.data.results) {
        spinner.stop(false);
        throw new Error('Failed to get tags from Docker Hub');
      }

      const tags = response.data.results.map((result: any) => result.name);

      spinner.stop(true, `Found ${tags.length} tags`);
      return tags;
    } catch (error) {
      logger.error(`Failed to list tags: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }


  /**
   * Login to Docker Hub
   * @param username Docker username
   * @param password Docker password
   * @param registry Docker registry
   * @returns Success status
   */
  async login(username: string, password?: string, registry?: string): Promise<boolean> {
    try {
      const spinner = logger.startSpinner(`Logging in to Docker Hub as ${username}`);

      // Check if already logged in
      const loggedIn = await this.checkLogin();
      if (loggedIn) {
        spinner.stop(true, `Logged in as ${username}`);
        this.setCredentials(username, registry);
        return true;
      }

      // Login to Docker
      await execa('docker', [
        'login',
        ...(registry ? [registry] : []),
        '-u',
        username,
        '--password-stdin'
      ], {
        input: password
      });

      spinner.stop(true, 'Logged in to Docker Hub successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to login to Docker Hub: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Check if Docker is logged in
   * @returns Success status
   */
  async checkLogin(): Promise<boolean> {
    try {
      const { stdout } = await execa('docker', ['login']);
      return stdout.includes('Login Succeeded');
    } catch (error) {
      return false;
    }
  }

  /**
   * Build a Docker Compose file
   * @param tag Tag for the image
   * @param envFile Optional path to environment file
   * @param version Version of the template to use
   * @returns Path to the generated Docker Compose file
   */
  async buildComposeFile(tag: string, envFile?: string, templateType?: string): Promise<string> {
    if (!this.username) {
      throw new Error('Docker Hub username is required for building compose file');
    }

    const template = (templateType == 'eliza') ? DOCKER_COMPOSE_ELIZA_V2_TEMPLATE : DOCKER_COMPOSE_BASIC_TEMPLATE;

    // Validate template structure
    const validatedTemplate = ComposeTemplateSchema.parse({ template });

    // Ensure compose files directory exists
    const composePath = COMPOSE_FILES_DIR;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(composePath)) {
      logger.info(`Creating directory: ${composePath}`);
      fs.mkdirSync(composePath, { recursive: true });
    }

    let envVars: string[] = [];
    
    // Only parse env file if it's provided
    if (envFile) {
      // Parse env file to get variable names
      const envContent = fs.readFileSync(envFile, 'utf-8');
      envVars = envContent
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          // Remove inline comments
          const commentIndex = line.indexOf('#');
          if (commentIndex > 0) {
            line = line.substring(0, commentIndex).trim();
          }
          return line.trim();
        })
        .filter(line => line.includes('='))
        .map(line => {
          const [key, value] = line.split('=', 2);
          const trimmedKey = key.trim();
          const trimmedValue = value ? value.trim() : '';

          // Skip empty values
          if (trimmedValue === '') {
            return null;
          }

          // Keep the original key without any transformation
          return `${trimmedKey}=${trimmedKey}`;  // Create KEY=KEY format
        })
        .filter(Boolean as any); // Remove null entries
    }

    // Create full image name with username
    const fullImageName = `${this.username}/${this.image}`;

    // Compile template with data
    const compiledTemplate = Handlebars.compile(validatedTemplate.template, { noEscape: true });
    const composeContent = compiledTemplate({
      imageName: fullImageName,
      tag,
      envVars: envVars.map(env => env.replace(/=.*/, '=\${' + env.split('=')[0] + '}'))
    });

    // Write the docker-compose file with standardized name in the compose directory
    const composeFile = path.join(composePath, `${this.image}-${tag}-tee-compose.yaml`);
    fs.writeFileSync(composeFile, composeContent);

    logger.success(`Backup of docker compose file created at: ${composeFile}`);
    return composeFile;
  }

  /**
   * Run a Docker Compose file locally
   * @param composePath Path to Docker Compose file
   * @param envFile Path to environment file
   * @returns Success status
   */
  async runComposeLocally(composePath: string, envFile?: string): Promise<boolean> {
    try {
      // TODO: Update log when optimized simulator is implemented
      const spinner = logger.startSpinner(`Running Docker Compose file at ${composePath}\n- If you run with the simulator, set DSTACK_SIMULATOR_ENDPOINT to http://host.docker.internal:8090`);

      // Ensure the Docker Compose file exists
      validateFileExists(composePath);

      // Build the command arguments
      const composeArgs = [
        '-f',
        composePath,
        'up',
        '-d'
      ];

      // Only add env-file if it's provided
      if (envFile) {
        // Ensure the environment file exists
        validateFileExists(envFile);
        composeArgs.splice(2, 0, '--env-file', envFile);
      }

      // Run the Docker Compose file
      await execAsync(`docker compose ${composeArgs.join(' ')}`);

      spinner.stop(true, 'Docker Compose file running successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to run Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Run the TEE simulator
   * @param image Simulator image
   * @returns Success status
   */
  async runSimulator(image: string, port: string): Promise<boolean> {
    try {
      logger.info(`Running TEE simulator with image ${image}`);

      logger.info('Pulling latest simulator image...');
      await execAsync(`docker pull ${image}`);

      logger.info('Starting simulator in background...');
      const { stdout } = await execAsync(`docker run -d --name tee-simulator --rm -p ${port}:${port} ${image}`);
      const containerId = stdout.trim();

      logger.success(`TEE simulator running successfully. Container ID: ${containerId}`);
      logger.info(`\n\nUseful commands:`);
      logger.info(`- View logs: docker logs -f ${containerId}`);
      logger.info(`- Stop simulator: docker stop ${containerId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to run TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Stop the TEE simulator
   * @returns Success status
   */
  async stopSimulator(): Promise<boolean> {
    try {
      const spinner = logger.startSpinner('Stopping TEE simulator...');

      // Stop the simulator
      await execAsync(`docker stop tee-simulator`);

      spinner.stop(true, 'TEE simulator stopped successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to stop TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * List local Docker images and their tags
   * @returns Array of objects with image name and tag
   */
  static async listLocalImages(): Promise<Array<{ name: string, tag: string }>> {
    try {
      // Query Docker for local images in format that outputs repository and tag
      const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
      const credentials = await getDockerCredentials();
      const username = credentials?.username;
      // Parse the output and filter out any <none> tags or images
      const imageList = stdout.split('\n')
        .filter(line => line && !line.includes('<none>'))
        .filter(line => line.includes(`${username}/`))
        .map(line => {
          const [repo, tag] = line.split(':');
          // Separate username/image format if available
          const nameParts = repo.split('/');
          const name = nameParts.length > 1 ? nameParts[1] : repo;
          return { name, tag };
        });

      return imageList;
    } catch (error) {
      logger.error(`Failed to list local Docker images: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

