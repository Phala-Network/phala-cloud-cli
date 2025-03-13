import chalk from "chalk"

/**
 * Strips ANSI color escape sequences from a string to get its visible length
 * @param str String that may contain ANSI color codes
 * @returns String with all ANSI color codes removed
 */
function stripAnsi(str: string): string {
  // ANSI escape sequence regex pattern
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return str.replace(new RegExp(pattern, 'g'), '');
}

/**
 * Gets the visible length of a string, ignoring ANSI color codes
 * @param str String that may contain ANSI color codes
 * @returns Visible length of the string
 */
function getVisibleLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Wraps text to fit within a specified width
 * @param text Text to wrap
 * @param maxWidth Maximum width for the text
 * @returns Array of lines of text
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [''];
  
  // Handle case where a single word is longer than maxWidth
  if (getVisibleLength(text) <= maxWidth) return [text];
  
  const lines: string[] = [];
  let currentLine = '';
  let currentLineVisibleLength = 0;
  
  // Split by any whitespace and preserve URLs
  const words = text.split(/(\s+)/).filter(word => word.trim().length > 0);
  
  for (const word of words) {
    const wordVisibleLength = getVisibleLength(word);
    
    // If the word itself is longer than maxWidth, split it
    if (wordVisibleLength > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
        currentLineVisibleLength = 0;
      }
      
      // This is a simplification as it's complex to split words with color codes
      // For long colored words, we'll just add them as-is
      lines.push(word);
      continue;
    }
    
    // If adding the word would exceed maxWidth
    if (currentLineVisibleLength + wordVisibleLength + (currentLineVisibleLength > 0 ? 1 : 0) > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
      currentLineVisibleLength = wordVisibleLength;
    } else {
      // Add word to current line
      if (currentLine) {
        currentLine = `${currentLine} ${word}`;
        currentLineVisibleLength += wordVisibleLength + 1; // +1 for space
      } else {
        currentLine = word;
        currentLineVisibleLength = wordVisibleLength;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

export const logger = {
  error: (message: string, ...args: any[]) => {
    console.error(chalk.red('✗'), chalk.red(message), ...args)
  },
  warn: (message: string, ...args: any[]) => {
    console.log(chalk.yellow('⚠'), chalk.yellow(message), ...args)
  },
  info: (message: string, ...args: any[]) => {
    console.log(chalk.blue('ℹ'), chalk.blue(message), ...args)
  },
  success: (message: string, ...args: any[]) => {
    console.log(chalk.green('✓'), chalk.green(message), ...args)
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), chalk.gray(message), ...args)
    }
  },
  table: <T>(
    data: T[], 
    columns?: Array<string> | Array<{ key: keyof T | string, header?: string }> | Array<any>
  ) => {
    if (data.length === 0) {
      console.log(chalk.yellow('No data to display'));
      return;
    }
    
    // Support for old API with just column names
    if (columns) {
      if (typeof columns[0] === 'string') {
        // Convert simple string array to column config
        const columnConfig = (columns as string[]).map(col => ({
          key: col,
          header: col.charAt(0).toUpperCase() + col.slice(1) // Capitalize
        }));
        
        // Filter data to only include specified columns
        formatTable(data, { 
          columns: columnConfig,
          borderStyle: 'rounded',
          headerStyle: (text) => chalk.cyan.bold(text)
        });
      } else {
        // Using the new column config format
        formatTable(data, { 
          columns: columns as Array<{ key: keyof T | string, header?: string }>,
          borderStyle: 'rounded',
          headerStyle: (text) => chalk.cyan.bold(text)
        });
      }
    } else {
      // No columns specified, show all
      formatTable(data, {
        borderStyle: 'rounded',
        headerStyle: (text) => chalk.cyan.bold(text)
      });
    }
  },
  /**
   * Displays an object's properties in a key-value table format (vertical table)
   * @param data Object to display
   * @param options Table display options
   */
  keyValueTable: <T extends object>(
    data: T,
    options?: {
      include?: string[];            // Optional list of keys to include
      exclude?: string[];            // Optional list of keys to exclude
      keyFormatter?: (key: string) => string;    // Optional formatter for keys
      valueFormatter?: (value: any, key: string) => string;  // Optional formatter for values
      formatKeys?: boolean;          // Whether to format keys (default: true)
      keyHeader?: string;            // Optional header for the key column
      valueHeader?: string;          // Optional header for the value column
      keyWidth?: number;             // Optional fixed width for the key column
      valueWidth?: number;           // Optional fixed width for the value column
      borderStyle?: 'single' | 'double' | 'rounded';  // Border style
      enableTextWrapping?: boolean;  // Whether to wrap text
      maxDepth?: number;             // Maximum depth for nested objects (default: 2)
    }
  ) => {
    // Default options
    const defaultOptions = {
      borderStyle: 'rounded' as const,
      enableTextWrapping: true,
      maxDepth: 2,
      formatKeys: true,
      // Improved key formatter with different formatting options
      keyFormatter: (key: string) => {
        // Common acronyms that should remain uppercase
        const commonAcronyms = [
          'URL', 'ID', 'API', 'UI', 'URI', 'CPU', 'GPU', 'RAM', 'JSON', 'XML', 'HTML', 
          'HTTP', 'HTTPS', 'SSH', 'FTP', 'IP', 'TCP', 'UDP', 'DNS', 'SSL', 'TLS', 'SQL', 
          'VCPU', 'CVM', 'TEE', 'IO'
        ];
        
        // Phala-specific terms with custom capitalization
        const customTerms = {
          'teepod': 'TEEPod',
          'dstack': 'Dstack'
        };
        
        // Handle different cases
        let formatted;
        
        if (key.includes('_')) {
          // Handle snake_case: convert app_url to App Url
          formatted = key.split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
        } else if (key.includes('-')) {
          // Handle kebab-case: convert app-url to App Url
          formatted = key.split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
        } else {
          // Handle camelCase: convert appUrl to App Url
          formatted = key.charAt(0).toUpperCase() + 
                      key.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
        }
        
        // Replace common acronyms in the formatted text, preserving case
        for (const acronym of commonAcronyms) {
          // Only uppercase the whole acronym if it appears as a whole word
          const regex = new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'gi');
          formatted = formatted.replace(regex, acronym);
        }
        
        // Apply custom term formatting
        for (const [term, replacement] of Object.entries(customTerms)) {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          formatted = formatted.replace(regex, replacement);
        }
        
        return formatted;
      },
      valueFormatter: (value: any) => String(value ?? '')
    };

    const mergedOptions = { ...defaultOptions, ...options };
    const { include, exclude, keyFormatter, valueFormatter, formatKeys, keyWidth, valueWidth, borderStyle, enableTextWrapping, maxDepth } = mergedOptions;

    // Extract keys based on include/exclude
    let keys = Object.keys(data);
    if (include) {
      keys = keys.filter(key => include.includes(key));
    }
    if (exclude) {
      keys = keys.filter(key => !exclude.includes(key));
    }

    // If no keys to display, show message and return
    if (keys.length === 0) {
      console.log(chalk.yellow('No properties to display'));
      return;
    }

    // Prepare the data array for the table formatter
    const tableData = keys.map(key => {
      const value = data[key as keyof T];
      
      // Format the value based on its type
      let formattedValue: string;
      if (value === null || value === undefined) {
        formattedValue = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle nested objects (but limit depth)
        formattedValue = formatNestedObject(value, 0, maxDepth);
      } else if (Array.isArray(value)) {
        // Handle arrays
        if (value.length === 0) {
          formattedValue = '[]';
        } else if (typeof value[0] === 'object') {
          // Array of objects
          formattedValue = `[${value.length} items]`;
        } else {
          // Array of primitives
          formattedValue = `[${value.join(', ')}]`;
        }
      } else {
        // Handle primitives
        formattedValue = String(value);
      }
      
      // Apply custom value formatter if provided
      if (valueFormatter) {
        formattedValue = valueFormatter(value, key);
      }
      
      return {
        key: formatKeys && keyFormatter ? keyFormatter(key) : key,
        value: formattedValue
      };
    });

    // Calculate column widths based on content
    const terminalWidth = getTerminalWidth();
    let finalKeyWidth = keyWidth;
    let finalValueWidth = valueWidth;
    
    // Calculate key column width based on content if not specified
    if (!finalKeyWidth) {
      finalKeyWidth = Math.max(
        ...tableData.map(item => getVisibleLength(item.key)),
        10 // Minimum key width
      );
      // Limit to 1/3 of terminal width
      finalKeyWidth = Math.min(finalKeyWidth, Math.floor(terminalWidth / 3));
    }
    
    // Calculate value column width based on content if not specified
    if (!finalValueWidth) {
      // Calculate based on actual content lengths
      finalValueWidth = Math.max(
        ...tableData.map(item => getVisibleLength(item.value)),
        10 // Minimum value width
      );
      
      // Add some padding for readability (3 chars)
      finalValueWidth += 3;
      
      // Ensure we don't exceed terminal width
      const borderChars = 7; // Typical border chars count
      const maxValueWidth = terminalWidth - finalKeyWidth - borderChars;
      finalValueWidth = Math.min(finalValueWidth, maxValueWidth);
    }

    // Configure border characters based on style
    const border = getBorderChars(borderStyle);

    // Header row
    const topBorder = `${border.topLeft}${border.horizontal.repeat(finalKeyWidth + 2)}${border.topT}${border.horizontal.repeat(finalValueWidth + 2)}${border.topRight}`;
    const headerSeparator = `${border.leftT}${border.horizontal.repeat(finalKeyWidth + 2)}${border.cross}${border.horizontal.repeat(finalValueWidth + 2)}${border.rightT}`;
    
    console.log(topBorder);
    console.log(headerSeparator);
    
    // Data rows
    tableData.forEach((row, index) => {
      const keyLines = enableTextWrapping ? wrapText(row.key, finalKeyWidth) : [row.key];
      const valueLines = enableTextWrapping ? wrapText(row.value, finalValueWidth) : [row.value];
      
      const maxLines = Math.max(keyLines.length, valueLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const keyLine = keyLines[i] || '';
        const valueLine = valueLines[i] || '';
        
        // Pad with spaces to align columns, accounting for invisible ANSI characters
        const keyContent = keyLine + ' '.repeat(Math.max(0, finalKeyWidth - getVisibleLength(keyLine)));
        const valueContent = valueLine + ' '.repeat(Math.max(0, finalValueWidth - getVisibleLength(valueLine)));
        
        console.log(`${border.vertical} ${keyContent} ${border.vertical} ${valueContent} ${border.vertical}`);
      }
      
      // Add a separator between rows, but not after the last row
      if (index < tableData.length - 1) {
        console.log(`${border.leftT}${border.horizontal.repeat(finalKeyWidth + 2)}${border.cross}${border.horizontal.repeat(finalValueWidth + 2)}${border.rightT}`);
      }
    });
    
    // Bottom border
    const bottomBorder = `${border.bottomLeft}${border.horizontal.repeat(finalKeyWidth + 2)}${border.bottomT}${border.horizontal.repeat(finalValueWidth + 2)}${border.bottomRight}`;
    console.log(bottomBorder);
  },
  startSpinner: (message: string) => {
    process.stdout.write(`${chalk.blue('⟳')} ${message}... `)
    return {
      stop: (success = true, result?: string) => {
        const icon = success ? chalk.green('✓') : chalk.red('✗')
        const resultText = result ? `: ${result}` : ''
        console.log(`${icon}${resultText}`)
      }
    }
  },
  break() {
    console.log("")
  },
}

/**
 * Formats a nested object for display in the keyValueTable
 */
function formatNestedObject(obj: any, currentDepth: number, maxDepth: number): string {
  if (currentDepth >= maxDepth) {
    return '[Nested Object]';
  }
  
  if (obj === null || obj === undefined) {
    return '';
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return `[${obj.length} items]`;
  }
  
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: `);
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${formatNestedObject(value, currentDepth + 1, maxDepth)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  return lines.join(', ');
}

/**
 * Get border characters based on style
 */
function getBorderChars(style: 'single' | 'double' | 'rounded' = 'single') {
  return {
    single: {
      topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘',
      horizontal: '─', vertical: '│', 
      leftT: '├', rightT: '┤', topT: '┬', bottomT: '┴', cross: '┼'
    },
    double: {
      topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
      horizontal: '═', vertical: '║',
      leftT: '╠', rightT: '╣', topT: '╦', bottomT: '╩', cross: '╬'
    },
    rounded: {
      topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯',
      horizontal: '─', vertical: '│',
      leftT: '├', rightT: '┤', topT: '┬', bottomT: '┴', cross: '┼'
    }
  }[style];
}

function getTerminalWidth(): number {
  return process.stdout.columns || 80; // Default to 80 if width cannot be determined
}

/**
 * Calculate column widths for tabular data display
 * @param data Array of objects to display in table
 * @param columns Configuration for each column to display
 * @param options Additional display options
 * @returns Object with calculated widths for each column
 */
export function calculateColumnWidths<T>(
  data: T[],
  columns: {
    key: keyof T;
    header: string;
    minWidth?: number;
    weight?: number; // Relative weight for distributing remaining space (default: 1)
    fixedWidth?: number; // If set, this column will have exactly this width
    getValue?: (item: T) => string; // Custom accessor for nested properties
    getWidth?: (item: T) => number; // Custom width calculator
  }[],
  options: {
    borderChars?: number; // Characters used for borders per column
    additionalBorderWidth?: number; // Additional border width (outer borders, etc.)
  } = {}
): { [key: string]: number } {
  const terminalWidth = getTerminalWidth();
  
  // Calculate total border width
  const borderCharsPerColumn = options.borderChars ?? 3; // Default "| " + " " per column
  const additionalBorderWidth = options.additionalBorderWidth ?? 1; // Default "|" at the end
  const totalBorderWidth = additionalBorderWidth + columns.length * borderCharsPerColumn;
  
  const availableContentWidth = terminalWidth - totalBorderWidth;
  
  // Calculate initial widths based on content and minimum requirements
  const initialWidths: { [key: string]: number } = {};
  let totalFixedWidth = 0;
  let totalWeight = 0;
  
  // First pass: Calculate initial widths and total weight
  for (const column of columns) {
    const key = column.key as string;
    
    if (column.fixedWidth !== undefined) {
      initialWidths[key] = column.fixedWidth;
      totalFixedWidth += column.fixedWidth;
      continue;
    }
    
    const minWidth = column.minWidth ?? column.header.length;
    
    let contentWidth: number;
    if (column.getWidth) {
      // Use custom width calculator if provided
      contentWidth = Math.max(
        minWidth,
        column.header.length,
        ...data.map(item => column.getWidth!(item))
      );
    } else if (column.getValue) {
      // Use custom accessor if provided
      contentWidth = Math.max(
        minWidth,
        column.header.length,
        ...data.map(item => String(column.getValue!(item) || '').length)
      );
    } else {
      // Default behavior
      contentWidth = Math.max(
        minWidth,
        column.header.length,
        ...data.map(item => String(item[column.key] || '').length)
      );
    }
    
    initialWidths[key] = contentWidth;
    totalFixedWidth += contentWidth;
    totalWeight += column.weight ?? 1;
  }
  
  // Calculate remaining width to distribute
  const remainingWidth = Math.max(0, availableContentWidth - totalFixedWidth);
  
  // If we have remaining width and weights, distribute according to weights
  if (remainingWidth > 0 && totalWeight > 0) {
    for (const column of columns) {
      const key = column.key as string;
      if (column.fixedWidth === undefined && column.weight) {
        const extraWidth = Math.floor(remainingWidth * (column.weight / totalWeight));
        initialWidths[key] += extraWidth;
      }
    }
  }
  
  // If total width would exceed terminal, scale everything down proportionally
  const calculatedTotalWidth = Object.values(initialWidths).reduce((sum, width) => sum + width, 0) + totalBorderWidth;
  
  if (calculatedTotalWidth > terminalWidth) {
    const scale = availableContentWidth / (calculatedTotalWidth - totalBorderWidth);
    
    const finalWidths: { [key: string]: number } = {};
    for (const column of columns) {
      const key = column.key as string;
      const minWidth = column.minWidth ?? column.header.length;
      finalWidths[key] = Math.max(minWidth, Math.floor(initialWidths[key] * scale));
    }
    
    return finalWidths;
  }
  
  return initialWidths;
}

/**
 * Example of how to use calculateColumnWidths with nested objects
 * @param data Array of objects with nested properties
 * @returns Object with calculated column widths
 */
export function calculateNestedTableWidths<T>(
  data: T[],
  columns: Array<{
    key: string; // Output key in the result object
    header: string;
    minWidth: number;
    weight?: number;
    accessor: (item: T) => string; // Function to access the nested property
  }>
): { [key: string]: number } {
  // Convert to the format expected by calculateColumnWidths
  const columnConfig = columns.map((col, index) => ({
    key: `col_${index}` as keyof T, // Use a unique key for each column
    header: col.header,
    minWidth: col.minWidth,
    weight: col.weight,
    getValue: col.accessor
  }));

  // Get the raw widths
  const widths = calculateColumnWidths(data, columnConfig, { borderChars: 3, additionalBorderWidth: 1 });
  
  // Remap to expected keys
  const result: { [key: string]: number } = {};
  columns.forEach((col, index) => {
    result[col.key] = widths[`col_${index}` as string];
  });
  
  return result;
}

/**
 * Format and display data as a table in the terminal with customizable styling
 * @param data Array of objects to display in table
 * @param options Table display options
 */
export function formatTable<T>(
  data: T[],
  options: {
    columns?: Array<{
      key: keyof T | string;
      header?: string;
      minWidth?: number;
      weight?: number;
      accessor?: (item: T) => any;
      formatter?: (value: any) => string;
      enableTextWrapping?: boolean; // Changed from wrapText to enableTextWrapping
    }>;
    includeHeaders?: boolean;
    border?: boolean;
    borderStyle?: 'single' | 'double' | 'rounded';
    headerStyle?: (text: string) => string;
    cellStyle?: (text: string, rowIndex: number, colKey: string) => string;
    enableTextWrapping?: boolean; // Global option to control text wrapping
    keyValueMode?: boolean; // Option to display a single object in key-value rows
  } = {}
): void {
  // If in key-value mode, transform the data
  if (options.keyValueMode && data.length === 1) {
    const obj = data[0];
    const keyValueData: Array<{key: string, value: any}> = [];
    
    // Generate columns if not provided
    if (!options.columns) {
      options.columns = Object.keys(obj).map(key => ({
        key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1') // Capitalize and add spaces
      }));
    }
    
    // Transform object to key-value rows
    for (const col of options.columns) {
      const key = String(col.key);
      let value;
      
      if (col.accessor) {
        value = col.accessor(obj);
      } else if (typeof col.key === 'string' && col.key.includes('.')) {
        // Handle dot notation for nested objects
        const parts = col.key.split('.');
        let current: any = obj;
        for (const part of parts) {
          if (current === null || current === undefined) {
            value = '';
            break;
          }
          current = current[part as keyof typeof current];
        }
        value = current;
      } else {
        value = obj[col.key as keyof T];
      }
      
      // Apply formatter if provided
      if (col.formatter) {
        value = col.formatter(value);
      }
      
      keyValueData.push({
        key: col.header || key,
        value: value
      });
    }
    
    // Replace data and columns
    data = keyValueData as unknown as T[];
    options.columns = [
      { key: 'key' as keyof T, minWidth: 15 },
      { key: 'value' as keyof T, minWidth: 20 }
    ];
  }

  if (data.length === 0) {
    console.log(chalk.yellow('No data to display'));
    return;
  }

  // Default options
  const defaultOptions = {
    includeHeaders: true,
    border: true,
    borderStyle: 'single' as const,
    headerStyle: (text: string) => chalk.bold(text),
    cellStyle: (text: string) => text,
    enableTextWrapping: true // Enable text wrapping by default
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Auto-generate columns if not provided
  let columns = mergedOptions.columns;
  if (!columns) {
    const sample = data[0];
    columns = Object.keys(sample).map(key => ({
      key,
      header: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize header
      enableTextWrapping: mergedOptions.enableTextWrapping
    }));
  } else {
    // Ensure all columns have enableTextWrapping property set if not explicitly defined
    columns = columns.map(col => ({
      ...col,
      enableTextWrapping: col.enableTextWrapping !== undefined ? col.enableTextWrapping : mergedOptions.enableTextWrapping
    }));
  }

  // Configure border characters based on style
  const borderChars = {
    single: {
      topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘',
      horizontal: '─', vertical: '│', 
      leftT: '├', rightT: '┤', topT: '┬', bottomT: '┴', cross: '┼'
    },
    double: {
      topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
      horizontal: '═', vertical: '║',
      leftT: '╠', rightT: '╣', topT: '╦', bottomT: '╩', cross: '╬'
    },
    rounded: {
      topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯',
      horizontal: '─', vertical: '│',
      leftT: '├', rightT: '┤', topT: '┬', bottomT: '┴', cross: '┼'
    }
  };

  const border = borderChars[mergedOptions.borderStyle];

  // Configure column config for width calculation
  const columnConfig = columns.map(col => ({
    key: col.key as keyof T,
    header: col.header || String(col.key),
    minWidth: col.minWidth || 3,
    weight: col.weight,
    enableTextWrapping: col.enableTextWrapping,
    getValue: col.accessor ? 
      (item: T) => col.accessor!(item) : 
      (item: T) => {
        // Handle dot notation for nested objects
        if (typeof col.key === 'string' && col.key.includes('.')) {
          const parts = col.key.split('.');
          let value: any = item;
          for (const part of parts) {
            if (value === null || value === undefined) return '';
            value = value[part as keyof typeof value];
          }
          return value ?? '';
        }
        return item[col.key as keyof T] ?? '';
      }
  }));

  // Calculate column widths
  const widths = calculateColumnWidths(data, columnConfig);

  // Prepare column and header arrays with proper keys
  const formattedColumns = columns.map((col, index) => ({
    ...col,
    width: widths[columnConfig[index].key as string]
  }));

  // Format headers and rows
  const headers = formattedColumns.map(col => col.header || String(col.key));
  
  // Helper to format a row with text wrapping support
  const formatRow = (row: T, rowIndex: number) => {
    // For each column, get the value and wrap it if needed
    const rowData = formattedColumns.map(col => {
      let value;
      if (col.accessor) {
        value = col.accessor(row);
      } else if (typeof col.key === 'string' && col.key.includes('.')) {
        // Handle dot notation for nested objects
        const parts = col.key.split('.');
        let current: any = row;
        for (const part of parts) {
          if (current === null || current === undefined) {
            value = '';
            break;
          }
          current = current[part as keyof typeof current];
        }
        value = current ?? '';
      } else {
        value = row[col.key as keyof T] ?? '';
      }
      
      // Format the value
      let displayValue = col.formatter ? col.formatter(value) : String(value || '');
      
      // Wrap text if enabled for this column
      if (col.enableTextWrapping) {
        return {
          lines: wrapText(displayValue, col.width),
          key: String(col.key)
        };
      } else {
        // Truncate if not wrapping
        return {
          lines: [displayValue.length > col.width ? 
                 displayValue.substring(0, col.width - 1) + '…' : 
                 displayValue],
          key: String(col.key)
        };
      }
    });
    
    // Calculate the maximum number of lines in any column for this row
    const maxLines = Math.max(...rowData.map(col => col.lines.length));
    
    // Format each line of the row
    const formattedLines = [];
    for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
      const lineContent = rowData.map((col, colIndex) => {
        const content = col.lines[lineIndex] || '';
        return mergedOptions.cellStyle(
          content.padEnd(formattedColumns[colIndex].width), 
          rowIndex, 
          col.key
        );
      });
      formattedLines.push(lineContent);
    }
    
    return formattedLines;
  };

  // Generate table parts
  if (mergedOptions.border) {
    // Top border
    const topBorder = border.topLeft + 
      formattedColumns.map(col => border.horizontal.repeat(col.width + 2)).join(border.topT) +
      border.topRight;
    console.log(topBorder);
    
    // Headers with possible wrapping
    if (mergedOptions.includeHeaders) {
      // Wrap header text if needed
      const wrappedHeaders = formattedColumns.map((col, i) => ({
        lines: col.enableTextWrapping ? wrapText(headers[i], col.width) : [headers[i]],
        width: col.width
      }));
      
      // Find the maximum number of lines in any header
      const maxHeaderLines = Math.max(...wrappedHeaders.map(h => h.lines.length));
      
      // Display each line of the header
      for (let lineIndex = 0; lineIndex < maxHeaderLines; lineIndex++) {
        const headerLine = border.vertical + 
          wrappedHeaders.map((header) => {
            const content = header.lines[lineIndex] || '';
            return ' ' + mergedOptions.headerStyle(content.padEnd(header.width)) + ' ';
          }).join(border.vertical) + 
          border.vertical;
        console.log(headerLine);
      }
      
      // Header-data separator
      const headerSeparator = border.leftT +
        formattedColumns.map(col => border.horizontal.repeat(col.width + 2)).join(border.cross) +
        border.rightT;
      console.log(headerSeparator);
    }
    
    // Data rows with text wrapping
    data.forEach((row, rowIndex) => {
      const formattedRows = formatRow(row, rowIndex);
      
      formattedRows.forEach(rowLine => {
        console.log(
          border.vertical + 
          rowLine.map(cell => ` ${cell} `).join(border.vertical) + 
          border.vertical
        );
      });
      
      // Optional: Add a separator between rows for better readability
      if (rowIndex < data.length - 1 && formattedRows.length > 1) {
        const rowSeparator = border.leftT +
          formattedColumns.map(col => border.horizontal.repeat(col.width + 2)).join(border.cross) +
          border.rightT;
        console.log(rowSeparator);
      }
    });
    
    // Bottom border
    const bottomBorder = border.bottomLeft + 
      formattedColumns.map(col => border.horizontal.repeat(col.width + 2)).join(border.bottomT) +
      border.bottomRight;
    console.log(bottomBorder);
  } else {
    // No borders, simpler display
    if (mergedOptions.includeHeaders) {
      // Wrap header text if needed
      const wrappedHeaders = formattedColumns.map((col, i) => ({
        lines: col.enableTextWrapping ? wrapText(headers[i], col.width) : [headers[i]],
        width: col.width
      }));
      
      // Find the maximum number of lines in any header
      const maxHeaderLines = Math.max(...wrappedHeaders.map(h => h.lines.length));
      
      // Display each line of the header
      for (let lineIndex = 0; lineIndex < maxHeaderLines; lineIndex++) {
        const headerLine = wrappedHeaders.map((header) => {
          const content = header.lines[lineIndex] || '';
          return mergedOptions.headerStyle(content.padEnd(header.width));
        }).join(' ');
        console.log(headerLine);
      }
      
      // Simple underline for headers
      const headerSeparator = formattedColumns.map(col => 
        '─'.repeat(col.width)
      ).join(' ');
      console.log(headerSeparator);
    }
    
    // Data rows with text wrapping
    data.forEach((row, rowIndex) => {
      const formattedRows = formatRow(row, rowIndex);
      
      formattedRows.forEach(rowLine => {
        console.log(rowLine.join(' '));
      });
      
      // Add a blank line between multi-line rows for better readability
      if (rowIndex < data.length - 1 && formattedRows.length > 1) {
        console.log('');
      }
    });
  }
  
  console.log(`Total: ${data.length} rows`);
}

