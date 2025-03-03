import axios from "axios";
import { CLOUD_API_URL, CLI_VERSION, CLOUD_URL } from "@/src/tee/constants";
import { getApiKey } from "@/src/tee/credential";
import {
    CreateCvmResponse,
    GetPubkeyFromCvmResponse,
    GetCvmByAppIdResponse,
    GetUserInfoResponse,
    UpgradeCvmResponse,
    GetCvmsByUserIdResponse,
} from "@/src/tee/types"

// Import the new helper function
import { calculateNestedTableWidths, logger, formatTable } from '../utils/logger';
import chalk from 'chalk';

const headers = {
    "User-Agent": `tee-cli/${CLI_VERSION}`,
    "Content-Type": "application/json",
};

let apiKey: string | null = null;

const retrieveApiKey = async () => {
    if (apiKey) {
        return apiKey;
    }

    apiKey = await getApiKey();
    if (!apiKey) {
        console.error("Error: API key not found. Please set an API key first.");
        process.exit(1);
    }
    return apiKey;
};

function wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [''];
    
    // Handle case where a single word is longer than maxWidth
    if (text.length <= maxWidth) return [text];
    
    const lines: string[] = [];
    let currentLine = '';
    
    // Split by any whitespace and preserve URLs
    const words = text.split(/(\s+)/).filter(word => word.trim().length > 0);
    
    for (const word of words) {
        // If the word itself is longer than maxWidth, split it
        if (word.length > maxWidth) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            for (let i = 0; i < word.length; i += maxWidth) {
                lines.push(word.slice(i, i + maxWidth));
            }
            continue;
        }
        
        // If adding the word would exceed maxWidth
        if (currentLine.length + word.length + 1 > maxWidth) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            // Add word to current line
            currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

function getTerminalWidth(): number {
    return process.stdout.columns || 80; // Default to 80 if width cannot be determined
}

function calculateColumnWidths(cvms: GetCvmsByUserIdResponse): { [key: string]: number } {
    return calculateNestedTableWidths(
        cvms,
        [
            { 
                key: 'name',
                header: 'Agent Name', 
                minWidth: 10, 
                accessor: (cvm) => cvm.hosted.name 
            },
            { 
                key: 'status',
                header: 'Status', 
                minWidth: 6,
                accessor: (cvm) => cvm.hosted.status 
            },
            { 
                key: 'appId',
                header: 'App ID', 
                minWidth: 8, 
                weight: 1,
                accessor: (cvm) => cvm.hosted.app_id 
            },
            { 
                key: 'appUrl',
                header: 'App URL', 
                minWidth: 7, 
                weight: 2,
                accessor: (cvm) => cvm.hosted.app_url 
            }
        ]
    );
}

function formatCvmsTable(cvms: GetCvmsByUserIdResponse): void {
    const columnWidths = calculateColumnWidths(cvms);
    
    // Create header separator
    const separator = `+-${'-'.repeat(columnWidths.name)}-+-${'-'.repeat(columnWidths.status)}-+-${'-'.repeat(columnWidths.appId)}-+-${'-'.repeat(columnWidths.appUrl)}-+`;

    // Print header
    console.log(separator);
    console.log(
        `| ${'Agent Name'.padEnd(columnWidths.name)} | ${'Status'.padEnd(columnWidths.status)} | ${'App ID'.padEnd(columnWidths.appId)} | ${'App URL'.padEnd(columnWidths.appUrl)} |`
    );
    console.log(separator);

    // Print rows with wrapped text
    cvms.forEach(cvm => {
        const nameLines = wrapText(cvm.hosted.name, columnWidths.name);
        const statusLines = wrapText(cvm.hosted.status, columnWidths.status);
        const appIdLines = wrapText(cvm.hosted.app_id, columnWidths.appId);
        const appUrlLines = wrapText(cvm.hosted.app_url, columnWidths.appUrl);

        // Get the maximum number of lines needed for this row
        const maxLines = Math.max(
            nameLines.length,
            statusLines.length,
            appIdLines.length,
            appUrlLines.length
        );

        // Print each line of the row
        for (let i = 0; i < maxLines; i++) {
            console.log(
                `| ${(nameLines[i] || '').padEnd(columnWidths.name)} | ` +
                `${(statusLines[i] || '').padEnd(columnWidths.status)} | ` +
                `${(appIdLines[i] || '').padEnd(columnWidths.appId)} | ` +
                `${(appUrlLines[i] || '').padEnd(columnWidths.appUrl)} |`
            );
        }

        // Add a separator after each row
        console.log(separator);
    });

    // Print total count
    console.log(`\nTotal CVMs: ${cvms.length}`);
}

async function queryTeepods(): Promise<any> {
    try {
        const response = await axios.get(`${CLOUD_API_URL}/api/v1/teepods`, {
            headers: { ...headers, "X-API-Key": await retrieveApiKey() },
        });
        return response.data;
    } catch (error: any) {
        console.error(
            "Error during teepod query:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function queryImages(teepodId: string): Promise<any> {
    try {
        const response = await axios.get(
            `${CLOUD_API_URL}/api/v1/teepods/${teepodId}/images`,
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data;
    } catch (error: any) {
        console.error(
            "Error during image query:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function queryCvmsByUserId(): Promise<GetCvmsByUserIdResponse | null> {
    try {
        const userInfo = await getUserInfo();
        const response = await axios.get(`${CLOUD_API_URL}/api/v1/cvms?user_id=${userInfo?.id}`, {
            headers: { ...headers, "X-API-Key": await retrieveApiKey() },
        });
        return response.data as GetCvmsByUserIdResponse;
    } catch (error: any) {
        console.error("Error during get cvms by user id:", error.response?.data || error.message);
        return null;
    }
}

async function createCvm(vm_config: any): Promise<CreateCvmResponse | null> {
    try {
        const response = await axios.post(
            `${CLOUD_API_URL}/api/v1/cvms/from_cvm_configuration`,
            vm_config,
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data as CreateCvmResponse;
    } catch (error: any) {
        console.error(
            "Error during create cvm:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function getPubkeyFromCvm(
    vm_config: any,
): Promise<GetPubkeyFromCvmResponse | null> {
    try {
        const response = await axios.post(
            `${CLOUD_API_URL}/api/v1/cvms/pubkey/from_cvm_configuration`,
            vm_config,
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data as GetPubkeyFromCvmResponse;
    } catch (error: any) {
        console.error(
            "Error during get pubkey from cvm:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function getCvmByAppId(
    appId: string,
): Promise<GetCvmByAppIdResponse | null> {
    try {
        const response = await axios.get(
            `${CLOUD_API_URL}/api/v1/cvms/app_${appId}`,
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data as GetCvmByAppIdResponse;
    } catch (error: any) {
        console.error(
            "Error during get cvm by app id:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function getUserInfo(): Promise<GetUserInfoResponse | null> {
    try {
        const getUserAuth = await axios.get(`${CLOUD_API_URL}/api/v1/auth/me`, {
            headers: { ...headers, "X-API-Key": await retrieveApiKey() },
        });
        const username = getUserAuth.data.username;
        const getUserId = await axios.get(`${CLOUD_API_URL}/api/v1/users/search?q=${username}`, {
            headers: { ...headers, "X-API-Key": await retrieveApiKey() },
        });
        const userId = getUserId.data.users[0].id;
        return { id: userId, username: username };
    } catch (error: any) {
        console.error("Error during get user info:", error.response?.data || error.message);
        return null;
    }
}

async function upgradeCvm(
    appId: string,
    vm_config: any,
): Promise<UpgradeCvmResponse | null> {
    try {
        const response = await axios.put(
            `${CLOUD_API_URL}/api/v1/cvms/app_${appId}/compose`,
            vm_config,
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data as UpgradeCvmResponse;
    } catch (error: any) {
        console.error(
            "Error during upgrade cvm:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function startCvm(appId: string): Promise<any> {
    try {
        const response = await axios.post(
            `${CLOUD_API_URL}/api/v1/cvms/app_${appId}/start`,
            { app_id: appId },
            {
                headers: { ...headers, "X-API-Key": await retrieveApiKey() },
            },
        );
        return response.data;
    } catch (error: any) {
        console.error(
            "Error during start cvm:",
            error.response?.data || error.message,
        );
        return null;
    }
}

async function listCvms(): Promise<void> {
    console.log("Fetching your CVMs...");
    const cvms = await queryCvmsByUserId();
    
    if (!cvms || cvms.length === 0) {
        console.log("No CVMs found for your account.");
        return;
    }

    formatCvmsTable(cvms);
}

/**
 * Display CVMs in a nicely formatted table using the enhanced table functionality
 */
async function listCvmsEnhanced(): Promise<void> {
    console.log("Fetching your CVMs...");
    const cvms = await queryCvmsByUserId();
    
    if (!cvms || cvms.length === 0) {
        console.log("No CVMs found for your account.");
        return;
    }

    // Transform the data for tabular display
    const tableData = cvms.map(cvm => ({
        name: cvm.hosted.name,
        status: cvm.hosted.status,
        vcpu: cvm.hosted.configuration.vcpu,
        memory: `${cvm.hosted.configuration.memory} MB`,
        diskSize: `${cvm.hosted.configuration.disk_size} GB`,
        image: cvm.hosted.configuration.image,
        appId: cvm.hosted.app_id,
        node: cvm.node.name,
        description: `This is a ${cvm.hosted.status} instance running on ${cvm.node.name} with ${cvm.hosted.configuration.vcpu} vCPU(s) and ${cvm.hosted.configuration.memory} MB memory. The app can be accessed at ${cvm.hosted.app_url}`,
    }));

    // Use the enhanced table formatter with text wrapping
    formatTable(tableData, {
        columns: [
            { 
                key: 'name', 
                header: 'Name', 
                minWidth: 10
            },
            { 
                key: 'status', 
                header: 'Status',
                minWidth: 8,
                formatter: (value) => {
                    if (value === 'running') return chalk.green(value);
                    if (value === 'stopped') return chalk.red(value);
                    return chalk.yellow(value);
                }
            },
            { 
                key: 'vcpu', 
                header: 'vCPU',
                minWidth: 5
            },
            { 
                key: 'memory', 
                header: 'Memory',
                minWidth: 8
            },
            { 
                key: 'diskSize', 
                header: 'Disk Size',
                minWidth: 9
            },
            { 
                key: 'image', 
                header: 'Image',
                minWidth: 15,
                weight: 1
            },
            { 
                key: 'node', 
                header: 'TEEPod',
                minWidth: 10
            },
            { 
                key: 'description', 
                header: 'Description',
                minWidth: 20,
                weight: 2
            }
        ],
        borderStyle: 'rounded',
        headerStyle: (text) => chalk.cyan.bold(text),
        enableTextWrapping: true // Enable text wrapping for all columns
    });
    
    // Show app URL separately with clickable link formatting
    console.log('\nApp URLs:');
    tableData.forEach(cvm => {
        console.log(`${chalk.cyan(cvm.name)}: ${chalk.blue.underline(`https://cloud.phala.network/dashboard/cvms/app_${cvm.appId}`)}`);
    });
}

/**
 * Display CVMs using the simplified logger.table function
 */
async function listCvmsSimple(): Promise<void> {
    console.log("Fetching your CVMs...");
    const cvms = await queryCvmsByUserId();
    
    if (!cvms || cvms.length === 0) {
        console.log("No CVMs found for your account.");
        return;
    }

    // Transform the data for tabular display with a long description that will wrap
    const tableData = cvms.map(cvm => ({
        name: cvm.hosted.name,
        status: cvm.hosted.status,
        details: `Running on ${cvm.node.name} with ${cvm.hosted.configuration.vcpu} vCPU, ${cvm.hosted.configuration.memory}MB RAM, and ${cvm.hosted.configuration.disk_size}GB storage.`,
        appId: cvm.hosted.app_id.substring(0, 10) + '...' // Truncate the App ID
    }));

    // Only call this once to demonstrate, not twice
    logger.info("Basic table using string array for column names:");
    logger.table(tableData, ['name', 'status', 'details', 'appId']);
    
    logger.break();
    logger.info("Enhanced table with column configurations:");
    const columnConfig: any[] = [
        { key: 'name', header: 'Agent Name', minWidth: 10 },
        { 
            key: 'status', 
            header: 'Status',
            formatter: (value: string) => value === 'running' ? 
                chalk.green('✓ ' + value) : chalk.red('✗ ' + value)
        },
        { key: 'details', header: 'System Details', minWidth: 20, weight: 2 },
        { key: 'appId', header: 'App ID', minWidth: 12 }
    ];
    logger.table(tableData, columnConfig);
}

/**
 * Display detailed information about a single CVM in a key-value table format
 * @param appId The CVM's app ID
 * @param useRawKeys Whether to display raw, unformatted keys (default: false)
 */
async function showCvmDetails(appId: string, useRawKeys: boolean = false): Promise<void> {
    console.log(`Fetching details for CVM with App ID: ${appId}...`);
    
    // Get basic CVM info
    const basicCvmInfo = await getCvmByAppId(appId);
    
    if (!basicCvmInfo) {
        logger.error(`No CVM found with App ID: ${appId}`);
        return;
    }
    
    // Get full CVM details by querying all CVMs and finding the matching one
    const allCvms = await queryCvmsByUserId();
    
    if (!allCvms || allCvms.length === 0) {
        logger.error("Could not retrieve full CVM details");
        return;
    }
    
    // Find the matching CVM with detailed information
    const cvm = allCvms.find(c => c.hosted.app_id === appId);
    
    if (!cvm) {
        // If we can't find the full details, display what we have
        logger.info("Basic CVM Details:");
        logger.keyValueTable(basicCvmInfo, {
            valueFormatter: (value, key) => {
                if (key === 'status') {
                    return value === 'running' ? chalk.green(value) : chalk.red(value);
                }
                if (key === 'app_url') {
                    return chalk.blue.underline(value);
                }
                return String(value || '');
            },
            formatKeys: !useRawKeys
        });
        return;
    }
    
    // Create a flattened view of the CVM with the most important properties
    const cvmDetails = {
        name: cvm.hosted.name,
        status: cvm.hosted.status,
        appId: cvm.hosted.app_id,
        appUrl: cvm.hosted.app_url,
        createdAt: cvm.hosted.exited_at ? new Date(cvm.hosted.exited_at).toLocaleString() : 'N/A',
        node: cvm.node.name,
        nodeId: cvm.node.id,
        image: cvm.hosted.configuration.image,
        vcpu: cvm.hosted.configuration.vcpu,
        memory: `${cvm.hosted.configuration.memory} MB`,
        diskSize: `${cvm.hosted.configuration.disk_size} GB`,
        ports: `${cvm.hosted.configuration.ports?.length || 0} ports configured`,
        // Adding the full configuration for demonstration
        fullConfiguration: cvm.hosted.configuration
    };

    // Display the details using the keyValueTable
    logger.info(`CVM Details${useRawKeys ? ' (with raw keys)' : ''}:`);
    logger.keyValueTable(cvmDetails, {
        // Optional: Exclude some fields
        exclude: ['fullConfiguration'],
        // Optional: Style the values based on field name
        valueFormatter: (value, key) => {
            if (key === 'status') {
                return value === 'running' 
                    ? chalk.green(value) 
                    : value === 'stopped' 
                        ? chalk.red(value) 
                        : chalk.yellow(value);
            }
            if (key === 'appUrl') {
                return chalk.blue.underline(value);
            }
            return String(value || '');
        },
        borderStyle: 'rounded',
        keyHeader: 'Property',
        valueHeader: 'Value',
        formatKeys: !useRawKeys // Use raw keys if specified
    });
    
    // Show the full configuration separately
    logger.info(`\nFull Configuration${useRawKeys ? ' (with raw keys)' : ''}:`);
    logger.keyValueTable(cvmDetails.fullConfiguration, {
        maxDepth: 3, // Allow deeper nesting for configuration details
        formatKeys: !useRawKeys // Use raw keys if specified
    });
}

/**
 * Demonstrate both key-value table display formats
 * @param appId The CVM's app ID
 */
async function demonstrateKeyValueTable(appId: string): Promise<void> {
    // Get basic CVM info
    const basicCvmInfo = await getCvmByAppId(appId);
    
    if (!basicCvmInfo) {
        logger.error(`No CVM found with App ID: ${appId}`);
        return;
    }
    
    // Method 1: Using the dedicated keyValueTable function with formatted keys
    logger.info("Method 1: Using the dedicated keyValueTable function with formatted keys");
    logger.keyValueTable(basicCvmInfo, {
        valueFormatter: (value, key) => {
            if (key === 'status') {
                return value === 'running' ? chalk.green(value) : chalk.red(value);
            }
            return String(value || '');
        },
        borderStyle: 'rounded',
        formatKeys: true // Default, can be omitted
    });
    
    logger.break();
    
    // Method 1B: Using unformatted keys (original API response keys)
    logger.info("Method 1B: Same data with unformatted keys (original API property names)");
    logger.keyValueTable(basicCvmInfo, {
        valueFormatter: (value, key) => {
            if (key === 'status') {
                return value === 'running' ? chalk.green(value) : chalk.red(value);
            }
            return String(value || '');
        },
        borderStyle: 'rounded',
        formatKeys: false // Show original key names
    });
    
    logger.break();
    
    // Method 2: Using the regular table function with keyValueMode option
    logger.info("Method 2: Using formatTable with keyValueMode option");
    formatTable([basicCvmInfo], {
        columns: [
            { key: 'name', header: 'Name' },
            { key: 'status', header: 'Status', 
              formatter: (value) => value === 'running' ? chalk.green(value) : chalk.red(value) },
            { key: 'app_id', header: 'App ID' },
            { key: 'app_url', header: 'App URL',
              formatter: (value) => chalk.blue.underline(value) }
        ],
        keyValueMode: true,
        borderStyle: 'rounded',
        headerStyle: (text) => chalk.cyan.bold(text)
    });
    
    // Get CVMs to demonstrate formatTable with multiple objects
    const cvms = await queryCvmsByUserId();
    
    if (!cvms || cvms.length === 0) {
        return;
    }
    
    logger.break();
    logger.info("For comparison - regular table with multiple rows:");
    
    // Transform data for display
    const tableData = cvms.map(cvm => ({
        name: cvm.hosted.name,
        status: cvm.hosted.status,
        appId: cvm.hosted.app_id,
        resources: `${cvm.hosted.configuration.vcpu} vCPU, ${cvm.hosted.configuration.memory}MB RAM`
    }));
    
    // Display as regular table
    formatTable(tableData, {
        columns: [
            { key: 'name', header: 'Name', minWidth: 10 },
            { key: 'status', header: 'Status', minWidth: 8,
              formatter: (value) => value === 'running' ? chalk.green(value) : chalk.red(value) },
            { key: 'appId', header: 'App ID', minWidth: 10 },
            { key: 'resources', header: 'Resources', minWidth: 20 }
        ],
        borderStyle: 'rounded',
        headerStyle: (text) => chalk.cyan.bold(text)
    });
}

export {
    createCvm,
    queryTeepods,
    queryImages,
    getPubkeyFromCvm,
    getCvmByAppId,
    getUserInfo,
    upgradeCvm,
    startCvm,
    queryCvmsByUserId,
    listCvms,
    listCvmsEnhanced,
    listCvmsSimple,
    showCvmDetails,
    demonstrateKeyValueTable,
};