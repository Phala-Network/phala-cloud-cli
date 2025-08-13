/**
 * Parse a string with optional unit into bytes
 * @param input The input string (e.g., '2G', '500MB', '1T')
 * @param defaultUnit Default unit to use if none specified (e.g., 'B', 'KB', 'MB', 'GB', 'TB')
 * @returns Number of bytes
 */
export function parseSizeWithUnit(input: string, defaultUnit: 'B' | 'KB' | 'MB' | 'GB' | 'TB' = 'B'): number {
    // Handle empty or invalid input
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid input: must be a non-empty string');
    }
  
    // Extract numeric value and unit using regex
    const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*([KkMmGgTt][Bb]?)?$/);
    
    if (!match) {
      throw new Error(`Invalid format: ${input}. Expected format: <number>[unit] (e.g., 2G, 500MB, 1T)`);
    }
  
    const value = parseFloat(match[1]);
    const unit = (match[2] || defaultUnit).toUpperCase().replace('B', '');
    
    // Convert to bytes based on unit
    const units: Record<string, number> = {
      'K': 1024,          // Kilo
      'M': 1024 * 1024,    // Mega
      'G': 1024 * 1024 * 1024,  // Giga
      'T': 1024 * 1024 * 1024 * 1024,  // Tera
      '': 1                // No unit (bytes)
    };
  
  
    if (!(unit in units)) {
      throw new Error(`Unsupported unit: ${unit}. Supported units: B, K/KB, M/MB, G/GB, T/TB`);
    }
  
    return Math.round(value * units[unit]);
  }
  
  /**
   * Parse memory input (default unit: MB)
   * @param input The input string (e.g., '2G', '500MB', '1024')
   * @returns Memory in MB (always a multiple of 1024MB = 1GB)
   * @throws If the value is not a multiple of 1GB
   */
  export function parseMemoryInput(input: string): number {
    const bytes = parseSizeWithUnit(input, 'MB');
    const memoryMB = Math.round(bytes / (1024 * 1024)); // Convert to MB
    
    // Ensure memory is a multiple of 1GB (1024MB)
    if (memoryMB % 1024 !== 0) {
      throw new Error(`Memory must be a multiple of 1GB (1024MB). Got: ${memoryMB}MB`);
    }
    
    return memoryMB;
  }
  
  /**
   * Parse disk size input (default unit: GB)
   * @param input The input string (e.g., '50G', '1T', '100')
   * @returns Disk size in GB (always a multiple of 1GB, max 250GB)
   * @throws If the value is not a multiple of 1GB or exceeds 250GB
   */
  export function parseDiskSizeInput(input: string): number {
    const bytes = parseSizeWithUnit(input, 'GB');
    const diskSizeGB = Math.round(bytes / (1024 * 1024 * 1024)); // Convert to GB
    
    // Ensure disk size is a multiple of 1GB
    if (diskSizeGB % 1 !== 0) {
      throw new Error(`Disk size must be a multiple of 1GB. Got: ${diskSizeGB}GB`);
    }
    
    // Ensure disk size doesn't exceed 250GB
    // TODO: once the default disk size limitation removed in DStack, we should remove this as well.
    const MAX_DISK_SIZE_GB = 250;
    if (diskSizeGB > MAX_DISK_SIZE_GB) {
      throw new Error(`Maximum disk size is ${MAX_DISK_SIZE_GB}GB. Got: ${diskSizeGB}GB`);
    }
    
    return diskSizeGB;
  }