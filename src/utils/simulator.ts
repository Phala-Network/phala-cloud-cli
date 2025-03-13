import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn, exec } from 'child_process';
import * as net from 'net';

// Configuration for simulator
const SIMULATOR_CONFIG = {
  version: '0.1.4',
  baseUrl: 'https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4',
  installDir: path.join(os.homedir(), '.phala-cloud', 'tappd-simulator'),
  // Default log file path
  defaultLogPath: path.join(os.homedir(), '.phala-cloud', 'logs', 'tappd-simulator.log'),
  platforms: {
    darwin: {
      filename: 'tappd-simulator-0.1.4-aarch64-apple-darwin.tgz',
      extractedFolder: 'tappd-simulator-0.1.4-aarch64-apple-darwin',
      socketArg: 'unix:/tmp/tappd.sock'
    },
    linux: {
      filename: 'tappd-simulator-0.1.4-x86_64-linux-musl.tgz',
      extractedFolder: 'tappd-simulator-0.1.4-x86_64-linux-musl',
      socketArg: 'unix:/tmp/tappd.sock'
    },
    win32: {
      filename: 'tappd-simulator-0.1.4-x86_64-pc-windows-msvc.tgz',
      extractedFolder: 'tappd-simulator-0.1.4-x86_64-pc-windows-msvc',
      socketArg: '127.0.0.1:8080'
    }
  }
};

/**
 * Check if the simulator is already installed
 * @returns boolean indicating if simulator is installed
 */
export function isSimulatorInstalled(): boolean {
  try {
    // Check if the main installation directory exists
    if (!fs.existsSync(SIMULATOR_CONFIG.installDir)) {
      return false;
    }

    // Get platform-specific folder name
    const platform = os.platform() as 'darwin' | 'linux' | 'win32';
    if (!SIMULATOR_CONFIG.platforms[platform]) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const extractedFolderPath = path.join(
      SIMULATOR_CONFIG.installDir,
      SIMULATOR_CONFIG.platforms[platform].extractedFolder
    );

    // Check if the extracted folder exists
    if (!fs.existsSync(extractedFolderPath)) {
      return false;
    }

    // Check if the executable exists
    const executableName = platform === 'win32' ? 'tappd-simulator.exe' : 'tappd-simulator';
    const executablePath = path.join(extractedFolderPath, executableName);
    return fs.existsSync(executablePath);
  } catch (error) {
    console.error('Error checking if simulator is installed:', error);
    return false;
  }
}

/**
 * Get the current platform
 * @returns The current platform: 'darwin', 'linux', or 'win32'
 * @throws Error if the platform is not supported
 */
export function getPlatform(): 'darwin' | 'linux' | 'win32' {
  const platform = os.platform() as 'darwin' | 'linux' | 'win32';
  if (!SIMULATOR_CONFIG.platforms[platform]) {
    throw new Error(`Unsupported platform: ${platform}. Only darwin, linux, and win32 are supported.`);
  }
  return platform;
}

/**
 * Install the simulator based on the current platform
 * @param progressCallback Optional callback to report progress
 * @returns Promise that resolves when installation is complete
 */
export async function installSimulator(
  progressCallback?: (message: string) => void
): Promise<void> {
  const log = (message: string) => {
    console.log(message);
    if (progressCallback) progressCallback(message);
  };

  try {
    const platform = getPlatform();
    const platformConfig = SIMULATOR_CONFIG.platforms[platform];
    
    // Create installation directory if it doesn't exist
    if (!fs.existsSync(SIMULATOR_CONFIG.installDir)) {
      log(`Creating installation directory at ${SIMULATOR_CONFIG.installDir}`);
      fs.mkdirSync(SIMULATOR_CONFIG.installDir, { recursive: true });
    }

    // Change to the installation directory
    process.chdir(SIMULATOR_CONFIG.installDir);
    
    // Download the simulator
    const downloadUrl = `${SIMULATOR_CONFIG.baseUrl}/${platformConfig.filename}`;
    log(`Downloading simulator from ${downloadUrl}`);
    execSync(`wget ${downloadUrl}`, { stdio: 'inherit' });
    
    // Extract the archive
    log(`Extracting ${platformConfig.filename}`);
    execSync(`tar -xvf ${platformConfig.filename}`, { stdio: 'inherit' });
    
    log('Simulator installation completed successfully');
  } catch (error) {
    console.error('Error installing simulator:', error);
    throw new Error(`Failed to install simulator: ${error}`);
  }
}

/**
 * Run the simulator
 * @param options Configuration options for running the simulator
 * @returns A child process representing the running simulator
 */
export function runSimulator(options: {
  background?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
} = {}): ReturnType<typeof spawn> {
  try {
    const platform = getPlatform();
    const platformConfig = SIMULATOR_CONFIG.platforms[platform];
    const extractedFolderPath = path.join(
      SIMULATOR_CONFIG.installDir,
      platformConfig.extractedFolder
    );
    
    // Change to the extracted folder directory
    process.chdir(extractedFolderPath);
    
    // Start the simulator
    const executableName = platform === 'win32' ? 'tappd-simulator.exe' : './tappd-simulator';
    
    // Default options
    const runOptions = {
      background: options.background ?? true,
      logToFile: options.logToFile ?? true,
      logFilePath: options.logFilePath ?? SIMULATOR_CONFIG.defaultLogPath
    };
    
    // Create log directory if it doesn't exist
    if (runOptions.logToFile) {
      const logDir = path.dirname(runOptions.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      console.log(`Simulator logs will be written to: ${runOptions.logFilePath}`);
    }
    
    console.log(`Starting simulator with: ${executableName} -l ${platformConfig.socketArg}`);
    
    // Configure stdio based on logging preferences
    let stdio: any = 'inherit';
    let outputStream: fs.WriteStream = null;
    
    if (runOptions.logToFile) {
      // Create/open the log file for appending
      outputStream = fs.createWriteStream(runOptions.logFilePath, { flags: 'a' });
      
      // Use the stream for both stdout and stderr
      stdio = ['ignore', outputStream, outputStream];
    }
    
    // Run the simulator
    const simulatorProcess = spawn(executableName, ['-l', platformConfig.socketArg], {
      stdio,
      shell: platform === 'win32', // Use shell on Windows
      detached: runOptions.background // Detach process when running in background
    });
    
    // Write startup entry to log file with timestamp
    if (outputStream) {
      const timestamp = new Date().toISOString();
      outputStream.write(`\n[${timestamp}] Simulator started\n`);
    }
    
    // If running in background, unref to allow the parent process to exit
    if (runOptions.background) {
      simulatorProcess.unref();
      console.log('Simulator is running in the background');
    }
    
    return simulatorProcess;
  } catch (error) {
    console.error('Error running simulator:', error);
    throw new Error(`Failed to run simulator: ${error}`);
  }
}

/**
 * Ensures the simulator is installed and running
 * @param options Configuration options for running the simulator
 * @returns A promise that resolves to a child process representing the running simulator
 */
export async function ensureSimulatorRunning(options: {
  background?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
} = {}): Promise<ReturnType<typeof spawn>> {
  if (!isSimulatorInstalled()) {
    console.log('Simulator not installed. Installing now...');
    await installSimulator((message) => console.log(`Installation progress: ${message}`));
  }
  
  if (await isSimulatorRunning()) {
    console.log('Simulator is already running');
    return null;
  }
  
  console.log('Starting simulator...');
  return runSimulator(options);
}

/**
 * Check if the simulator is currently running
 * For Unix platforms (Darwin/Linux), checks if the Unix socket exists and is accessible
 * For Windows, tries to connect to the TCP port the simulator should be listening on
 * @returns Promise<boolean> indicating if the simulator is running
 */
export async function isSimulatorRunning(): Promise<boolean> {
  try {
    const platform = getPlatform();
    const platformConfig = SIMULATOR_CONFIG.platforms[platform];
    
    if (platform === 'darwin' || platform === 'linux') {
      // For Unix platforms, check if the socket file exists and is accessible
      const socketPath = '/tmp/tappd.sock';
      
      // Check if the socket file exists
      if (!fs.existsSync(socketPath)) {
        return false;
      }
      
      // Try to connect to the socket to verify it's active
      return new Promise<boolean>((resolve) => {
        const client = net.createConnection({ path: socketPath })
          .on('connect', () => {
            client.end();
            resolve(true);
          })
          .on('error', () => {
            resolve(false);
          });
          
        // Set timeout to avoid hanging if socket exists but nothing is listening
        setTimeout(() => {
          client.end();
          resolve(false);
        }, 1000);
      });
    } else if (platform === 'win32') {
      // For Windows, try to connect to the TCP port
      const host = '127.0.0.1';
      const port = 8080;
      
      return new Promise<boolean>((resolve) => {
        const client = net.createConnection({ host, port })
          .on('connect', () => {
            client.end();
            resolve(true);
          })
          .on('error', () => {
            resolve(false);
          });
          
        // Set timeout to avoid hanging
        setTimeout(() => {
          client.end();
          resolve(false);
        }, 1000);
      });
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if simulator is running:', error);
    return false;
  }
}

/**
 * Stops the simulator if it's running
 * @returns Promise<boolean> indicating if the simulator was successfully stopped
 */
export async function stopSimulator(): Promise<boolean> {
  try {
    const platform = getPlatform();
    
    if (!await isSimulatorRunning()) {
      console.log('Simulator is not running');
      return true;
    }
    
    console.log('Stopping simulator...');
    
    if (platform === 'win32') {
      // For Windows, find the process listening on port 8080 and kill it
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :8080\') do taskkill /F /PID %a', { stdio: 'inherit' });
    } else {
      // For Unix platforms, find and kill the tappd-simulator process
      execSync('pkill -f tappd-simulator', { stdio: 'inherit' });
    }
    
    // Verify the simulator has stopped
    const stopped = !(await isSimulatorRunning());
    if (stopped) {
      console.log('Simulator stopped successfully');
    } else {
      console.log('Failed to stop simulator');
    }
    
    return stopped;
  } catch (error) {
    console.error('Error stopping simulator:', error);
    return false;
  }
}

/**
 * Gets the path to the simulator log file
 * @param customPath Optional custom log file path
 * @returns The path to the log file
 */
export function getSimulatorLogPath(customPath?: string): string {
  return customPath ?? SIMULATOR_CONFIG.defaultLogPath;
}

/**
 * Reads the recent logs from the simulator log file
 * @param options Options for reading logs
 * @returns Recent log content or null if log file doesn't exist
 */
export function getSimulatorLogs(options: {
  logFilePath?: string;
  maxLines?: number;
} = {}): string | null {
  const logFilePath = options.logFilePath ?? SIMULATOR_CONFIG.defaultLogPath;
  const maxLines = options.maxLines ?? 100;
  
  try {
    if (!fs.existsSync(logFilePath)) {
      return null;
    }
    
    // Read the log file
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    
    // Split by lines and get the most recent ones
    const lines = logContent.split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch (error) {
    console.error('Error reading simulator logs:', error);
    return null;
  }
}
