import { Client as PhalaCloudClient, createClient } from '@phala/cloud';
import { getApiKey } from '../utils/credentials';
import { logger } from '../utils/logger';
import { CLI_VERSION } from '../utils/constants';

// Helper function to safely stringify objects that might contain cyclic references
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (error instanceof Error && error.message.includes('cyclic')) {
      return '[Cyclic Object]';
    }
    return String(obj);
  }
}

export class PhalaCloudClientWrapper {
    private client: PhalaCloudClient | null = null;
    private apiKey: string | null = null;
    private initializationPromise: Promise<void> | null = null;
    private static instance: PhalaCloudClientWrapper;
  
    // Make constructor private to ensure singleton usage
    private constructor() {}
  
    // Get the singleton instance
    public static async getInstance(): Promise<PhalaCloudClientWrapper> {
      if (!PhalaCloudClientWrapper.instance) {
        PhalaCloudClientWrapper.instance = new PhalaCloudClientWrapper();
      }
      await PhalaCloudClientWrapper.instance.ensureInitialized();
      return PhalaCloudClientWrapper.instance;
    }
  
    public async ensureInitialized(): Promise<void> {
      if (!this.initializationPromise) {
        this.initializationPromise = this.initializeClient();
      }
      return this.initializationPromise;
    }
  
    private async initializeClient() {
      this.apiKey = await getApiKey();
      if (!this.apiKey) {
        throw new Error('API key not found. Please set an API key first with "phala auth login"');
      }
  
      this.client = createClient({
        apiKey: this.apiKey,
        headers: {
          'User-Agent': `tee-cloud-cli/${CLI_VERSION}`
        }
      });
  
      this.setupLogging();
    }
  

  private setupLogging() {
    const originalRequest = this.client.safeGet;
    this.client.safeGet = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      try {
        const response = await originalRequest.call(this.client, input, init);
        logger.debug(`Received successful response from: ${url}`);
        return response;
      } catch (error: any) {
        this.handleError(error, url);
        throw error;
      }
    };
  }

  private handleError(error: any, url: string) {
    if (error.response) {
      const { status, data } = error.response;
      
      logger.debug(`Error response from ${url}: ${status} - ${safeStringify(data)}`);
      
      if (status === 401) {
        logger.error('Authentication failed. Please check your API key.');
      } else if (status === 403) {
        logger.error('You do not have permission to perform this action.');
      } else if (status === 404) {
        logger.error('Resource not found.');
      } else {
        logger.error(`API Error (${status}): ${data?.message || safeStringify(data)}`);
      }
    } else if (error.request) {
      logger.error('No response received from the server. Please check your internet connection.');
      logger.debug(`Request details: ${safeStringify(error.request).substring(0, 200)}...`);
    } else {
      logger.error(`Error: ${error.message}`);
    }
  }

  // Proxy all methods from PhalaCloudClient
  public async get<T>(url: string, config?: any): Promise<T> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client.get(url, config);
  }

  public async post<T>(url: string, data?: any, config?: any): Promise<T> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client.post(url, data, config);
  }

  public async put<T>(url: string, data?: any, config?: any): Promise<T> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client.put(url, data, config);
  }

  public async delete<T>(url: string, config?: any): Promise<T> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client.delete(url, config);
  }

  public async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client.patch(url, data, config);
  }
}

// Create and export a singleton instance
let _phalaCloudClient: PhalaCloudClientWrapper | null = null;
export async function getPhalaCloudClient(): Promise<PhalaCloudClientWrapper> {
  if (!_phalaCloudClient) {
    _phalaCloudClient = await PhalaCloudClientWrapper.getInstance();
    try {
      await _phalaCloudClient.ensureInitialized();
    } catch (error) {
      _phalaCloudClient = null;
      throw error;
    }
  }
  return _phalaCloudClient;
}

export const apiClient = getPhalaCloudClient();
