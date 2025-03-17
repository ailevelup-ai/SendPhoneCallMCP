#!/bin/bash

# Exit on error
set -e

ENVIRONMENT="staging"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"
RUNTIME="nodejs22.x"

echo "Creating Lambda Layers for ${STACK_NAME}..."

# Check AWS CLI access
echo "Testing AWS CLI access..."
aws sts get-caller-identity > /dev/null || {
  echo "Error: AWS CLI is not configured or lacks permissions"
  exit 1
}

# Create directories
echo "Creating layer directories..."
mkdir -p lambda-layers/dependencies/nodejs
mkdir -p lambda-layers/utils/nodejs/lib
mkdir -p lambda-layers/utils/nodejs/services
mkdir -p lambda-layers/utils/nodejs/utils

# Copy dependencies
echo "Copying dependencies..."
cp -r node_modules lambda-layers/dependencies/nodejs/

# Copy utility files
echo "Copying utility files..."
cp -r functions/lib/* lambda-layers/utils/nodejs/lib/
cp -r functions/services/* lambda-layers/utils/nodejs/services/
cp -r functions/utils/* lambda-layers/utils/nodejs/utils/

# Create layer zips
echo "Creating layer zip files..."
(cd lambda-layers/dependencies && zip -r ../dependencies-layer.zip .)
(cd lambda-layers/utils && zip -r ../utils-layer.zip .)

# Publish dependencies layer
echo "Publishing dependencies layer..."
DEPENDENCIES_LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name "${STACK_NAME}-dependencies" \
  --description "Dependencies for ${STACK_NAME}" \
  --zip-file fileb://lambda-layers/dependencies-layer.zip \
  --compatible-runtimes "${RUNTIME}" \
  --region ${REGION} \
  --query 'Version' \
  --output text)

DEPENDENCIES_LAYER_ARN=$(aws lambda get-layer-version \
  --layer-name "${STACK_NAME}-dependencies" \
  --version-number ${DEPENDENCIES_LAYER_VERSION} \
  --region ${REGION} \
  --query 'LayerVersionArn' \
  --output text)

# Publish utils layer
echo "Publishing utils layer..."
UTILS_LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name "${STACK_NAME}-utils" \
  --description "Utility functions for ${STACK_NAME}" \
  --zip-file fileb://lambda-layers/utils-layer.zip \
  --compatible-runtimes "${RUNTIME}" \
  --region ${REGION} \
  --query 'Version' \
  --output text)

UTILS_LAYER_ARN=$(aws lambda get-layer-version \
  --layer-name "${STACK_NAME}-utils" \
  --version-number ${UTILS_LAYER_VERSION} \
  --region ${REGION} \
  --query 'LayerVersionArn' \
  --output text)

# Save layer ARNs to files
echo "DEPENDENCIES_LAYER_ARN=${DEPENDENCIES_LAYER_ARN}" > lambda-layers/dependencies-layer-arn.env
echo "UTILS_LAYER_ARN=${UTILS_LAYER_ARN}" > lambda-layers/utils-layer-arn.env

echo "Lambda Layers created successfully!"
echo "Dependencies Layer ARN: ${DEPENDENCIES_LAYER_ARN}"
echo "Utils Layer ARN: ${UTILS_LAYER_ARN}" 