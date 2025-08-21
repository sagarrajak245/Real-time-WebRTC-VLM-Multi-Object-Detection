# Use an official Node.js runtime as a parent image (version 20 as required by package.json)
FROM node:20-slim

# Install necessary tools: wget and unzip for ngrok
RUN apt-get update && apt-get install -y wget unzip && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Manually install the correct ngrok binary for the container's architecture
RUN ARCH=$(uname -m) && \
    case ${ARCH} in \
        x86_64) NGROK_ARCH="amd64" ;; \
        aarch64) NGROK_ARCH="arm64" ;; \
        *) echo "Unsupported architecture: ${ARCH}"; exit 1 ;; \
    esac && \
    wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${NGROK_ARCH}.zip && \
    unzip ngrok-v3-stable-linux-${NGROK_ARCH}.zip && \
    mv ngrok /usr/local/bin/ngrok && \
    rm ngrok-v3-stable-linux-${NGROK_ARCH}.zip

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install app dependencies, including optional ones for server mode
RUN npm install --include=optional

# Bundle app source
COPY . .

# Your app binds to port 3000, so expose it
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "server/index.js" ]
