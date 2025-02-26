import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from './logger';
import { DOCKER_HUB_API_URL } from './constants';
import { getDockerCredentials } from './credentials';
import Handlebars from 'handlebars';

export class DockerService {
  private username: string;
  private image: string;
  private registry: string;

  constructor(image: string, username?: string, registry?: string) {
    this.image = image;
    this.username = username || '';
    this.registry = registry || '';
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
      const spinner = logger.startSpinner(`Building Docker image ${this.username}/${this.image}:${tag}`);
      
      // Ensure the Dockerfile exists
      if (!fs.existsSync(dockerfile)) {
        spinner.stop(false);
        throw new Error(`Dockerfile not found at ${dockerfile}`);
      }

      // Get the directory containing the Dockerfile
      const dockerfileDir = path.dirname(dockerfile);
      
      // Build the image
      await execa('docker', [
        'build',
        '-t',
        `${this.username}/${this.image}:${tag}`,
        '-f',
        dockerfile,
        dockerfileDir
      ]);
      
      spinner.stop(true, 'Docker image built successfully');
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
        throw new Error('Docker credentials not found. Please log in first with "teecloud docker login"');
      }

      // Push the image
      await execa('docker', [
        'push',
        `${this.username}/${this.image}:${tag}`
      ]);
      
      spinner.stop(true, 'Docker image pushed successfully');
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
        throw new Error('Docker credentials not found. Please log in first with "teecloud docker login"');
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
      if (!fs.existsSync(templatePath)) {
        spinner.stop(false);
        throw new Error(`Template not found at ${templatePath}`);
      }
      
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
      if (!fs.existsSync(composePath)) {
        spinner.stop(false);
        throw new Error(`Docker Compose file not found at ${composePath}`);
      }
      
      // Ensure the environment file exists
      if (!fs.existsSync(envFile)) {
        spinner.stop(false);
        throw new Error(`Environment file not found at ${envFile}`);
      }
      
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
      const spinner = logger.startSpinner(`Running TEE simulator with image ${image}`);
      
      // Pull the image
      await execa('docker', ['pull', image]);
      
      // Run the simulator
      await execa('docker', [
        'run',
        '-d',
        '--name',
        'tee-simulator',
        '-p',
        '8000:8000',
        image
      ]);
      
      spinner.stop(true, 'TEE simulator running successfully');
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
      const spinner = logger.startSpinner('Stopping TEE simulator');
      
      // Stop the simulator
      await execa('docker', ['stop', 'tee-simulator']);
      
      // Remove the container
      await execa('docker', ['rm', 'tee-simulator']);
      
      spinner.stop(true, 'TEE simulator stopped successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to stop TEE simulator: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 