import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { DockerOperations } from "../docker";
import * as fs from "fs";
import * as path from "path";

describe("DockerOperations", () => {
    const testDir = path.join(process.cwd(), "src/tee/__tests__/fixtures");
    
    // Create test directory and files before tests
    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    // Clean up after tests
    afterAll(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe("buildComposeFile", () => {
        test("should handle env file with comments", async () => {
            // Create test env file
            const envFile = path.join(testDir, "test.env");
            fs.writeFileSync(envFile, `
                # This is a comment
                KEY1=value1
                KEY2=value2 # inline comment
                KEY3=value3 // another comment
                KEY4=value=with=equals # comment here
                KEY5_KEY=secret # comment about key
                
                # Another comment
                EMPTY_KEY=
                VALID_KEY=valid
            `);

            const docker = new DockerOperations("test-image", "test-user");
            const composePath = await docker.buildComposeFile("latest", envFile);

            // Read generated compose file
            const composeContent = fs.readFileSync(composePath, "utf-8");

            // Verify environment variables are correctly processed
            expect(composeContent).toContain("KEY1=${KEY1}");
            expect(composeContent).toContain("KEY2=${KEY2}");
            expect(composeContent).toContain("KEY3=${KEY3}");
            expect(composeContent).toContain("KEY4=${KEY4}");
            expect(composeContent).toContain("KEY5_KEY=${KEY5_KEY}"); // Keep the original key name
            expect(composeContent).toContain("VALID_KEY=${VALID_KEY}"); // Keep the original key name
            
            // Verify comments and empty values are removed
            expect(composeContent).not.toContain("# This is a comment");
            expect(composeContent).not.toContain("inline comment");
            expect(composeContent).not.toContain("EMPTY_KEY");
        });

        test("should handle env file with special characters", async () => {
            const envFile = path.join(testDir, "special.env");
            fs.writeFileSync(envFile, `
                URL=http://example.com?param=value
                JSON={"key": "value"}
                MULTI=line1\\nline2
                QUOTED="quoted value" # comment
                SPACES=  spaced value  # comment
            `);

            const docker = new DockerOperations("test-image", "test-user");
            const composePath = await docker.buildComposeFile("latest", envFile);
            const composeContent = fs.readFileSync(composePath, "utf-8");

            expect(composeContent).toContain("URL=${URL}");
            expect(composeContent).toContain("JSON=${JSON}");
            expect(composeContent).toContain("MULTI=${MULTI}");
            expect(composeContent).toContain("QUOTED=${QUOTED}");
            expect(composeContent).toContain("SPACES=${SPACES}");
        });

        test("should throw error when env file doesn't exist", async () => {
            const docker = new DockerOperations("test-image", "test-user");
            await expect(
                docker.buildComposeFile("latest", "nonexistent.env")
            ).rejects.toThrow();
        });
    });
}); 