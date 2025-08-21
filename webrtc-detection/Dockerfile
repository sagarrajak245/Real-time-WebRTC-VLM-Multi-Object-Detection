# Use an official Node.js runtime as a parent image (version 20 as required by package.json)
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install app dependencies, including optional ones for server mode
# The --include=optional flag ensures onnxruntime-node is installed
RUN npm install --include=optional

# Bundle app source
COPY . .

# Your app binds to port 3000, so expose it
EXPOSE 3000

# Define the command to run your app 
CMD [ "node", "server/index.js" ]
