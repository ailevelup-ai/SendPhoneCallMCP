#!/bin/bash
set -e

# Use the Homebrew-installed AWS CLI if available
if [ -f "/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws" ]; then
  AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"
else
  AWS_CLI="aws"
fi

# Environment and region
ENVIRONMENT=${1:-staging}
REGION=${2:-us-east-1}

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 staging us-east-1"
  exit 1
fi

# Service name
SERVICE_NAME="ailevelup-phone-call-mcp"

echo "======================================================================"
echo "Updating Lambda Functions for ${SERVICE_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "======================================================================"

# Check for the Layer ARN
if [ -f "layer-arn.env" ]; then
  source layer-arn.env
  echo "Using Lambda Layer: ${LAMBDA_LAYER_ARN}"
else
  echo "Lambda Layer ARN not found in layer-arn.env"
  echo "Please run deploy-lambda-layer.sh first"
  exit 1
fi

# Process the functions
echo "Getting Lambda functions..."
FUNCTIONS=$($AWS_CLI lambda list-functions \
  --region "${REGION}" \
  --query "Functions[?starts_with(FunctionName, '${SERVICE_NAME}-${ENVIRONMENT}')].FunctionName" \
  --output text)

if [ -z "$FUNCTIONS" ]; then
  echo "No Lambda functions found for ${SERVICE_NAME}-${ENVIRONMENT}"
  exit 1
fi

echo "Found the following Lambda functions:"
echo "$FUNCTIONS"

# Fix function paths with the Node.js script
echo "Fixing Lambda function paths..."
node fix-lambda-paths.js

# Update each function
for FUNCTION_NAME in $FUNCTIONS; do
  # Extract the base name (e.g., make-call from ailevelup-phone-call-mcp-staging-make-call)
  BASE_NAME=$(echo "$FUNCTION_NAME" | sed -E "s/${SERVICE_NAME}-${ENVIRONMENT}-//")
  
  echo "Updating function: ${FUNCTION_NAME} (${BASE_NAME})"
  
  # Check if the zip file exists
  ZIP_FILE="functions-slim/${BASE_NAME}.zip"
  if [ ! -f "$ZIP_FILE" ]; then
    echo "Warning: Zip file not found for ${BASE_NAME}. Skipping..."
    continue
  fi
  
  # Update function code
  echo "Updating code for ${FUNCTION_NAME}..."
  $AWS_CLI lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_FILE}" \
    --region "${REGION}" \
    --publish

  # Update function configuration to use the layer
  echo "Updating configuration for ${FUNCTION_NAME}..."
  $AWS_CLI lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --layers "${LAMBDA_LAYER_ARN}" \
    --region "${REGION}"
    
  echo "✓ Function ${FUNCTION_NAME} updated successfully!"
done

echo "All Lambda functions have been updated successfully!"
echo "======================================================================" 