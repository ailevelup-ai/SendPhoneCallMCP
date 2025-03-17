#!/bin/bash

# Package preparation script for AilevelUp Phone Call MCP service
set -e  # Exit on error

ENVIRONMENT="staging"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "===================================================================="
echo "Preparing deployment packages for AilevelUp Phone Call MCP service"
echo "Environment: ${ENVIRONMENT}"
echo "Stack Name: ${STACK_NAME}"
echo "===================================================================="

# Check for required files
if [ ! -f .env.staging ]; then
  echo "Error: .env.staging file not found"
  exit 1
fi

# Step 1: Create deployment packages for Lambda functions
echo "Creating deployment packages..."
LAMBDA_FUNCTIONS=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

# Create packages directory if it doesn't exist
mkdir -p deployment-packages

for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  FUNCTION_FILE="functions/${FUNCTION}.js"
  
  if [ ! -f "${FUNCTION_FILE}" ]; then
    echo "Warning: Function file ${FUNCTION_FILE} not found. Skipping."
    continue
  fi
  
  echo "Preparing package for: ${FUNCTION_NAME}"
  
  # Create zip file for the function
  echo "Creating package directory..."
  PACKAGE_DIR="deployment-packages/${FUNCTION}"
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"
  
  # Copy function file
  cp "${FUNCTION_FILE}" "${PACKAGE_DIR}/"
  
  # Copy shared files (handler, utils, etc.)
  if [ -f "functions/index.js" ]; then
    cp "functions/index.js" "${PACKAGE_DIR}/"
  fi
  
  if [ -d "utils" ]; then
    mkdir -p "${PACKAGE_DIR}/utils"
    cp -r utils/* "${PACKAGE_DIR}/utils/"
  fi

  # Copy index.js if it exists at root level
  if [ -f "index.js" ]; then
    cp "index.js" "${PACKAGE_DIR}/"
  fi
  
  # Copy node_modules if they exist
  if [ -d "node_modules" ]; then
    echo "Copying node_modules (this may take a while)..."
    cp -r node_modules "${PACKAGE_DIR}/"
  fi
  
  # Load environment variables into the package
  grep -v '^#' .env.staging > "${PACKAGE_DIR}/.env"
  
  # Create zip file
  echo "Creating zip archive for ${FUNCTION}..."
  (cd "${PACKAGE_DIR}" && zip -r "../../deployment-packages/${FUNCTION}.zip" .)
  
  echo "Package for ${FUNCTION} created successfully."
done

echo "===================================================================="
echo "All deployment packages created successfully!"
echo "Packages are available in the deployment-packages directory."
echo "Run deploy-from-packages.sh to deploy the prepared packages."
echo "====================================================================" 