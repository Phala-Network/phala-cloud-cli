import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from './logger';
import { DOCKER_HUB_API_URL } from './constants';
import { getDockerCredentials } from './credentials';
import Handlebars from 'handlebars';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { validateFileExists } from './prompts';

const execAsync = promisify(exec);
const LOGS_DIR = '.tee-cloud/logs';
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
   * Delete a Docker image tag
   * @param tag Tag to delete
   * @returns Success status
   */
  async deleteTag(tag: string): Promise<boolean> {
    try {
      const spinner = logger.startSpinner(`Deleting tag ${this.username}/${this.image}:${tag}`);
      
      // Check if user is logged in
      const credentials = await getDockerCredentials();
      if (!credentials) {
        spinner.stop(false);
        throw new Error('Docker credentials not found. Please log in first with "phala docker login"');
      }

      // Delete the tag using Docker Hub API
      const response = await axios.delete(
        `${DOCKER_HUB_API_URL}/repositories/${this.username}/${this.image}/tags/${tag}`,
        {
          auth: {
            username: credentials.username,
            password: credentials.password
          }
        }
      );
      
      spinner.stop(true, 'Tag deleted successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to delete tag: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Login to Docker Hub
   * @param username Docker username
   * @param password Docker password
   * @param registry Docker registry
   * @returns Success status
   */
  async login(username: string, password: string, registry?: string): Promise<boolean> {
    try {
      const spinner = logger.startSpinner(`Logging in to Docker Hub as ${username}`);
      
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
   * Build a Docker Compose file
   * @param tag Tag for the image
   * @param envFile Path to environment file
   * @param version Version of the template to use
   * @returns Path to the generated Docker Compose file
   */
  async buildComposeFile(tag: string, envFile: string, version: string = 'basic'): Promise<string> {
    try {
      const spinner = logger.startSpinner(`Building Docker Compose file for ${this.username}/${this.image}:${tag}`);
      
      // Get the template path
      const templatePath = path.join(__dirname, '..', 'templates', `docker-compose-${version}.hbs`);
      
      // Ensure the template exists
      validateFileExists(templatePath);
      
      // Read the template
      const template = fs.readFileSync(templatePath, 'utf8');
      
      // Compile the template
      const compiledTemplate = Handlebars.compile(template);
      
      // Read environment variables
      const envVars: Record<string, string> = {};
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        for (const line of envContent.split('\n')) {
          if (line.includes('=')) {
            const [key, value] = line.split('=');
            if (key && value) {
              envVars[key.trim()] = value.trim();
            }
          }
        }
      }
      
      // Generate the Docker Compose file
      const composeContent = compiledTemplate({
        image: `${this.username}/${this.image}:${tag}`,
        env: Object.entries(envVars).map(([key, value]) => ({ key, value }))
      });
      
      // Write the Docker Compose file
      const outputPath = path.join(process.cwd(), `docker-compose-${this.image}-${tag}.yml`);
      fs.writeFileSync(outputPath, composeContent);
      
      spinner.stop(true, `Docker Compose file generated at ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`Failed to build Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Run a Docker Compose file locally
   * @param composePath Path to Docker Compose file
   * @param envFile Path to environment file
   * @returns Success status
   */
  async runComposeLocally(composePath: string, envFile: string): Promise<boolean> {
    try {
      const spinner = logger.startSpinner(`Running Docker Compose file at ${composePath}`);
      
      // Ensure the Docker Compose file exists
      validateFileExists(composePath);
      
      // Ensure the environment file exists
      validateFileExists(envFile);
      
      // Run the Docker Compose file
      await execa('docker-compose', [
        '-f',
        composePath,
        '--env-file',
        envFile,
        'up',
        '-d'
      ]);
      
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
  async runSimulator(image: string): Promise<boolean> {
    try {
      logger.info(`Running TEE simulator with image ${image}`);
      
      logger.info('Pulling latest simulator image...');
      await execAsync(`docker pull ${image}`);

      logger.info('Starting simulator in background...');
      const { stdout } = await execAsync(`docker run -d --name tee-simulator --rm -p 8090:8090 ${image}`);
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
} 