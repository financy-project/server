FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# Install additional tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    gh \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

RUN npm install -g @anthropic-ai/claude-code

# Ensure sudo doesn't require password for non-root user
RUN apt-get update && apt-get install -y sudo && \
    echo '%sudo ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy dependency files with correct permissions
COPY --chown=node:node package.json pnpm-lock.yaml* ./

# Run as non-root user (node)
USER node
