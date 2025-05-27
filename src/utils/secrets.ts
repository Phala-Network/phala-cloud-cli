import * as fs from 'node:fs';
import type { EnvVar } from '@phala/dstack-sdk/encrypt-env-vars';

export const parseEnv = (envs: string[], envFile: string): EnvVar[] => {
    const envVars: Record<string, string> = {};

    // Process environment variables passed directly
    if (envs) {
        for (const env of envs) {
            if (env.includes("=")) {
                const [key, ...valueParts] = env.split("=");
                const value = valueParts.join("="); // Handle cases where value might contain '='
                if (key) { // Allow empty value
                    envVars[key] = value;
                }
            }
        }
    }

    if (envFile) {
        const envFileContent = fs.readFileSync(envFile, "utf8");
        for (const line of envFileContent.split("\n")) {
            // Skip empty lines
            if (!line.trim()) {
                continue;
            }

            // Skip comments
            if (line.trim().startsWith('#')) {
                continue;
            }

            // Find the first '=' that is not part of an inline comment
            let delimiterIndex = -1;
            let inQuotes = false;
            let quoteChar = '';

            for (let i = 0; i < line.length; i++) {
                if ((line[i] === '"' || line[i] === "'" || line[i] === '`') && (i === 0 || line[i-1] !== '\\')) {
                    if (inQuotes && line[i] === quoteChar) {
                        inQuotes = false;
                        quoteChar = '';
                    } else if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = line[i];
                    }
                } else if (line[i] === '=' && !inQuotes) {
                    delimiterIndex = i;
                    break;
                } else if (line[i] === '#' && !inQuotes) {
                    // If a comment starts before any '=', treat the whole line as a comment if no '=' found yet
                    // Or, if '=' is found, this part is an inline comment.
                    if (delimiterIndex === -1) { // No '=' encountered yet, so this is a full-line comment essentially or malformed
                        // We already skip lines starting with #, this handles cases like "   #comment"
                        // or "KEY #comment" (which is not a valid assignment according to rules)
                        // However, the rule " # marks the beginning of a comment (unless when the value is wrapped in quotes)"
                        // implies that "KEY=value #comment" is valid.
                        // The current logic handles inline comments on the value side later.
                        // If # appears before =, it's either a full comment (handled) or part of the key (unusual, but let it pass to split)
                    }
                    break; // Stop processing at the comment marker for the key or if it's an inline comment for the value
                }
            }


            if (delimiterIndex === -1) {
                 // Handles lines without '=' or lines that are effectively comments.
                if (!line.trim().startsWith('#')) {
                    // It's not a comment line, but has no '='.
                    // According to "EMPTY= becomes {EMPTY: ''}", lines like "ONLYKEY" are not defined.
                    // So we can skip them or treat as an error. Skipping for now.
                }
                continue;
            }

            const key = line.substring(0, delimiterIndex).trim();
            let value = line.substring(delimiterIndex + 1);

            // Remove inline comments from the value part
            // A comment starts with ' #' (space followed by #)
            // unless the # is within quotes.
            let valueInQuotes = false;
            let valueQuoteChar = '';
            let commentStartIndex = -1;

            for (let i = 0; i < value.length; i++) {
                if ((value[i] === '"' || value[i] === "'" || value[i] === '`') && (i === 0 || value[i-1] !== '\\')) {
                     if (valueInQuotes && value[i] === valueQuoteChar) {
                        valueInQuotes = false;
                        valueQuoteChar = '';
                    } else if (!valueInQuotes) {
                        valueInQuotes = true;
                        valueQuoteChar = value[i];
                    }
                } else if (value[i] === '#' && !valueInQuotes && i > 0 && value[i-1] === ' ') {
                    commentStartIndex = i -1; // Start of " #"
                    break;
                } else if (value[i] === '#' && !valueInQuotes && i === 0) { // Value starts directly with #
                    commentStartIndex = i;
                    break;
                }
            }

            if (commentStartIndex !== -1) {
                value = value.substring(0, commentStartIndex);
            }


            // Handle empty values: EMPTY= becomes {EMPTY: ''}
            if (value === undefined) { // Should not happen if split correctly
                value = '';
            }


            // Trim whitespace for unquoted values, preserve for quoted
            const firstChar = value.charAt(0);
            const lastChar = value.charAt(value.length - 1);

            if ((firstChar === '"' && lastChar === '"') ||
                (firstChar === "'" && lastChar === "'") ||
                (firstChar === '`' && lastChar === '`')) {
                // Quoted value, remove the outer quotes
                value = value.substring(1, value.length - 1);

                // Expand newlines for double-quoted values
                if (firstChar === '"') {
                    value = value.replace(/\\\\n/g, '\n');
                }
                // Unescape inner quotes for single and backtick quotes if they were escaped like \\' or \\`
                // The rules state "inner quotes are maintained (think JSON)"
                // and "single and double quoted values are escaped"
                // This implies that within a string like SINGLE_QUOTE='value with \\' quote'
                // the result should be "value with ' quote"
                // For JSON example: JSON={"foo": "bar"} becomes {JSON:"{\"foo\": \"bar\"}"}
                // This needs careful handling. The current approach of just slicing quotes might be too simple.
                // Let's assume the provided examples are the source of truth.
                // "JSON={"foo": "bar"}" -> JSON: "{\"foo\": \"bar\"}"
                // This means the quotes *around* the JSON are stripped, but the inner quotes *within* the JSON string literal itself are preserved.
                // The rule "single and double quoted values are escaped (SINGLE_QUOTE='quoted' becomes {SINGLE_QUOTE: "quoted"})"
                // seems to imply that the outer quotes are removed, and the content becomes a JS string.
                // The parsing engine should output a JS object, so values will be JS strings.
                // SINGLE_QUOTE='quoted' -> {SINGLE_QUOTE: 'quoted'} (JS string)
                // FOO="  some value  " -> {FOO: '  some value  '} (JS string)
                // JSON={"foo": "bar"} -> {JSON: '{"foo": "bar"}'} (JS string)
                // MULTILINE="new\\nline" -> {MULTILINE: 'new\\nline'} (JS string with literal \n)
                // The rule says: MULTILINE="new\\nline" becomes {MULTILINE: 'new\nline'} (with actual newline)
                // So, my previous .replace(/\\n/g, '\n') for double quotes is correct.

                // For single quotes and backticks, the rules don't explicitly state escaped char handling other than `\\n` for double quotes.
                // "inner quotes are maintained (think JSON)" - this is key for JSON={"foo": "bar"}
                // Let's ensure that if a value is `'{"key": "value"}'`, it becomes `{"key": "value"}`.
                // The current `substring(1, value.length - 1)` does this.
                // Let's consider BACKTICK_KEY=`This has 'single' and "double" quotes inside of it.`
                // This should become {BACKTICK_KEY: "This has 'single' and \"double\" quotes inside of it."}
                // The current slicing handles this correctly. Escaped backticks like \` needs to be considered if they should be unescaped.
                // The rules do not specify un-escaping for \\', \\", or \\` within their respective quotes.
                // So, 'it\'s a test' would become "it\'s a test". If it should be "it's a test", then un-escaping is needed.
                // Given "single and double quoted values are escaped", it seems like what's inside the quotes is the literal string value.
                // Let's stick to the examples: SINGLE_QUOTE='quoted' becomes {SINGLE_QUOTE: "quoted"}. This means the value is 'quoted'.
            } else {
                // Unquoted value, trim whitespace
                value = value.trim();
            }


            if (key) { // Ensure key is not empty
                envVars[key] = value;
            }
        }
    }

    // Add environment variables to the payload
    return Object.entries(envVars).map(([key, value]) => ({
        key,
        value,
    }));
};