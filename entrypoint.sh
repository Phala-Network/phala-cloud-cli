#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "Starting container initialization..."

# --- Phala Cloud Authentication ---
if [ -z "$PHALA_CLOUD_API_KEY" ]; then
  echo "WARNING: PHALA_CLOUD_API_KEY environment variable not set. Skipping Phala Cloud login."
else
  echo "Attempting Phala Cloud login..."
  # Assuming 'phala' command is in the PATH
  phala auth login "$PHALA_CLOUD_API_KEY"
  echo "Phala Cloud login attempted."
fi

# --- Docker Registry Authentication ---
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKERHUB_TOKEN" ]; then
  echo "WARNING: DOCKER_USERNAME or DOCKERHUB_TOKEN environment variable not set. Skipping Docker login."
else
  echo "Attempting Docker registry login..."
  # Assuming 'phala' command is in the PATH
  # Make sure your CLI tool correctly handles docker login non-interactively
  docker login -u "$DOCKER_USERNAME" -p "$DOCKERHUB_TOKEN"
  echo "Docker registry login attempted."
fi

echo "Initialization complete. Executing command: $@"

# Execute the command passed as arguments to the script
# In our case, this will be ["ttyd", "-W", "bash"] from the Dockerfile CMD
exec "$@" 