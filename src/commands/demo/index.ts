import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { getApiKey } from "@/src/utils/credentials";
import { getUserInfo } from "@/src/api/auth";
import { createCvm, getPubkeyFromCvm } from "@/src/api/cvms";
import { DEFAULT_IMAGE, CLOUD_URL } from "@/src/utils/constants";
import { demoTemplates } from "@/src/utils/demo";
import {
	encryptEnvVars,
	type EnvVar,
} from "@phala/dstack-sdk/encrypt-env-vars";
import inquirer from "inquirer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseEnv } from "@/src/utils/secrets";

export const demoCommands = new Command()
  .name("demo")
  .description("Demo commands to launch a demo on Phala Cloud")
  .action(async () => {
    try {
      // 1. Check if the user is logged in
      const apiKey = await getApiKey();
      if (!apiKey) {
        logger.error("You need to be logged in to use the demo command");
        logger.info("Please login with: phala auth login");
        process.exit(1);
      }

      // Verify user credentials
      try {
        const spinner = logger.startSpinner("Verifying your credentials");
        const userInfo = await getUserInfo();
        spinner.stop(true);
        logger.success(`Logged in as ${userInfo.username}`);
      } catch (error) {
        logger.error("Authentication failed. Your API key may be invalid or expired.");
        logger.info("Please set a new API key with: phala auth login");
        process.exit(1);
      }

      // 2. Get list of available templates
      const templates = Object.values(demoTemplates);

      if (templates.length === 0) {
        logger.error("No template files found in the templates directory");
        process.exit(1);
      }

      // 3. Prompt user to select a template
      const { selectedTemplate } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedTemplate",
          message: "Select a template to deploy:",
          choices: templates.map(t => ({
            name: t.name,
            value: t
          }))
        }
      ]);

      // 4. Read the selected template
      const templateContent = selectedTemplate.compose;
      logger.success(`Selected template: ${selectedTemplate.name}`);

      // 5. Generate a random token for services that might need it
      const token = crypto.randomBytes(16).toString("hex");
      const envVars = parseEnv([`TOKEN=${token}`], "");
      
      
      // 6. Ask for CVM name
      const { cvmName } = await inquirer.prompt([
        {
          type: "input",
          name: "cvmName",
          message: "Enter a name for your CVM:",
          default: `${selectedTemplate.name.replace(" ", "-")}`,
          validate: (input) => {
            if (!input.trim()) {
              return "CVM name is required";
            }
            return true;
          }
        }
      ]);

      // 7. Deploy the CVM with the specified resources
      logger.info("Preparing to deploy your CVM...");
      
      // Prepare VM configuration with specified resources
      const vmConfig = {
        teepod_id: 3,
        name: cvmName,
        image: DEFAULT_IMAGE,
        vcpu: 2,
        memory: 2048,
        disk_size: 20,
        compose_manifest: {
          docker_compose_file: templateContent,
          docker_config: {
            url: "",
            username: "",
            password: "",
          },
          features: ["kms", "tproxy-net"],
          kms_enabled: true,
          manifest_version: 2,
          name: cvmName,
          public_logs: true,
          public_sysinfo: true,
          tproxy_enabled: true,
        },
        listed: false,
      };

      // Get public key from CVM for the API call structure
      const spinner = logger.startSpinner("Preparing CVM configuration");
      const pubkey = await getPubkeyFromCvm(vmConfig);
      spinner.stop(true);
      
      if (!pubkey) {
        logger.error("Failed to prepare CVM configuration");
        process.exit(1);
      }

      const encrypted_env = await encryptEnvVars(
							envVars,
							pubkey.app_env_encrypt_pubkey,
						);

      logger.debug("Public key:", pubkey.app_env_encrypt_pubkey);
      logger.debug("Encrypted environment variables:", encrypted_env);
      // Create the CVM
      const createSpinner = logger.startSpinner("Creating your demo CVM");
      const response = await createCvm({
        ...vmConfig,
        encrypted_env,
        app_env_encrypt_pubkey: pubkey.app_env_encrypt_pubkey,
        app_id_salt: pubkey.app_id_salt,
      });
      createSpinner.stop(true);

      if (!response) {
        logger.error("Failed to create demo CVM");
        process.exit(1);
      }

      logger.success("Demo CVM created successfully! 🎉");
      logger.break();
      
      const tableData = {
        "CVM ID": response.id,
        "Name": response.name,
        "Status": response.status,
        "App ID": `app_${response.app_id}`,
        "App URL": response.app_url ? response.app_url : `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
        "Template": selectedTemplate.name,
        "Resources": "2 vCPUs, 2GB RAM, 20GB Storage",
      };
      
      if (selectedTemplate.name.includes("Jupyter Notebook")) {
        tableData["Jupyter Token"] = token;
        tableData["Access Instructions"] = "Access your Jupyter notebook using the token above. Go to 'Network' tab to see the public URL.";
      }
      
      logger.keyValueTable(tableData, {
        borderStyle: "rounded"
      });

      logger.break();
      logger.success(`Your demo is being created. You can check its status with:\nphala cvms get app_${response.app_id}`);

    } catch (error) {
      logger.error(`Failed to launch demo: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
