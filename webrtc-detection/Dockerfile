# --- Stage 1: Builder ---
# This stage has all the tools needed to compile native dependencies
FROM node:20-slim AS builder

# Install essential build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Set environment variable to force CPU-only install for onnxruntime-node
ENV ORT_FORCE_CPU=true

# Install all dependencies with verbose output to help debug issues
RUN npm install --verbose

# --- Stage 2: Production ---
# This is the final, clean image for running the application
FROM node:20-slim

# Install runtime dependencies (wget, unzip for ngrok)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Manually install the correct ngrok binary
RUN ARCH=$(uname -m) && \
    case ${ARCH} in \
    x86_64) NGROK_ARCH="amd64" ;; \
    aarch64) NGROK_ARCH="arm64" ;; \
    *) echo "Unsupported architecture: ${ARCH}"; exit 1 ;; \
    esac && \
    wget --no-check-certificate -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${NGROK_ARCH}.zip && \
    unzip ngrok-v3-stable-linux-${NGROK_ARCH}.zip && \
    mv ngrok /usr/local/bin/ngrok && \
    chmod +x /usr/local/bin/ngrok && \
    rm ngrok-v3-stable-linux-${NGROK_ARCH}.zip

# Copy the pre-built node_modules from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules 

# Copy the application source code
COPY . .

# Create necessary directories
RUN mkdir -p bench public server/models

# Expose the application port
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "server/index.js" ]