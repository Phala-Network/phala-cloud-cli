# Start with Node.js 22 as the base image
FROM node:22-slim AS base

# Install necessary dependencies and Docker
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    wget \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd from GitHub releases
ARG TARGETARCH
RUN TTYD_VERSION=$(curl -s "https://api.github.com/repos/tsl0922/ttyd/releases/latest" | grep -Po '"tag_name": "\K.*?(?=")') && \
    TTYD_ARCH="" && \
    case ${TARGETARCH} in \
        amd64) TTYD_ARCH="x86_64" ;; \
        arm64) TTYD_ARCH="aarch64" ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    wget "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}" -O /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd && \
    # Clean up wget
    apt-get purge -y --auto-remove wget && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash

# Set environment variables early so bun command is found
ENV PATH="/root/.bun/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Copy the entrypoint script and make it executable
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set the entrypoint script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default command passed to the entrypoint script (starts the webshell)
CMD ["ttyd", "-W", "bash"] 