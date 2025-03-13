#!/bin/bash

# Start the application in production mode

# Build the client
echo "Building client..."
npm run build

# Start the server in production mode
echo "Starting server in production mode..."
NODE_ENV=production npm start 