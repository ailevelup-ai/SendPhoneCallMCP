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

# Service name and layer name
SERVICE_NAME="ailevelup-phone-call-mcp"
LAYER_NAME="${SERVICE_NAME}-${ENVIRONMENT}-dependencies"

echo "======================================================================"
echo "Deploying Lambda Layer for ${SERVICE_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Layer Name: ${LAYER_NAME}"
echo "======================================================================"

# Create temporary build directory
BUILD_DIR="$(pwd)/layer-build"
LAYER_DIR="${BUILD_DIR}/nodejs"
mkdir -p "${LAYER_DIR}"

echo "Creating Lambda Layer directory structure..."

# Copy package.json
cp package.json "${LAYER_DIR}/"
cp package-lock.json "${LAYER_DIR}/" 2>/dev/null || :

# Install production dependencies
echo "Installing production dependencies..."
pushd "${LAYER_DIR}" > /dev/null
npm install --production
popd > /dev/null

# Create directories for shared code
mkdir -p "${LAYER_DIR}/lib"
mkdir -p "${LAYER_DIR}/services"
mkdir -p "${LAYER_DIR}/utils"
mkdir -p "${LAYER_DIR}/middlewares"
mkdir -p "${LAYER_DIR}/config"

# Copy shared code
echo "Copying shared code to layer..."
cp -r lib/* "${LAYER_DIR}/lib/" 2>/dev/null || mkdir -p "${LAYER_DIR}/lib"
cp -r services/* "${LAYER_DIR}/services/" 2>/dev/null || mkdir -p "${LAYER_DIR}/services"
cp -r utils/* "${LAYER_DIR}/utils/" 2>/dev/null || mkdir -p "${LAYER_DIR}/utils"
cp -r middlewares/* "${LAYER_DIR}/middlewares/" 2>/dev/null || mkdir -p "${LAYER_DIR}/middlewares"
cp -r config/* "${LAYER_DIR}/config/" 2>/dev/null || mkdir -p "${LAYER_DIR}/config"

# Copy .env file (for environment variables)
cp .env "${LAYER_DIR}/"

# Create zip file for layer
echo "Creating zip file for Lambda Layer..."
LAYER_ZIP="${SERVICE_NAME}-layer.zip"
pushd "${BUILD_DIR}" > /dev/null
zip -r ../"${LAYER_ZIP}" .
popd > /dev/null

# Check if the layer already exists
LAYER_EXISTS=$($AWS_CLI lambda list-layer-versions \
  --layer-name "${LAYER_NAME}" \
  --region "${REGION}" \
  --query "LayerVersions[0].LayerVersionArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$LAYER_EXISTS" ] || [ "$LAYER_EXISTS" == "None" ]; then
  echo "Creating new Lambda Layer: ${LAYER_NAME}"
  LAYER_VERSION_ARN=$($AWS_CLI lambda publish-layer-version \
    --layer-name "${LAYER_NAME}" \
    --description "Shared dependencies for ${SERVICE_NAME}" \
    --zip-file "fileb://${LAYER_ZIP}" \
    --compatible-runtimes nodejs18.x nodejs20.x nodejs22.x \
    --region "${REGION}" \
    --query "LayerVersionArn" \
    --output text)
else
  echo "Updating existing Lambda Layer: ${LAYER_NAME}"
  LAYER_VERSION_ARN=$($AWS_CLI lambda publish-layer-version \
    --layer-name "${LAYER_NAME}" \
    --description "Shared dependencies for ${SERVICE_NAME}" \
    --zip-file "fileb://${LAYER_ZIP}" \
    --compatible-runtimes nodejs18.x nodejs20.x nodejs22.x \
    --region "${REGION}" \
    --query "LayerVersionArn" \
    --output text)
fi

echo "Lambda Layer ARN: ${LAYER_VERSION_ARN}"

# Update functions to use the layer
echo "Updating Lambda functions to use the layer..."

# Get all Lambda functions for this service
FUNCTIONS=$($AWS_CLI lambda list-functions \
  --region "${REGION}" \
  --query "Functions[?starts_with(FunctionName, '${SERVICE_NAME}-${ENVIRONMENT}')].FunctionName" \
  --output text)

for FUNCTION_NAME in $FUNCTIONS; do
  echo "Updating function: ${FUNCTION_NAME}"
  $AWS_CLI lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --layers "${LAYER_VERSION_ARN}" \
    --region "${REGION}"
done

# Clean up
echo "Cleaning up..."
rm -rf "${BUILD_DIR}"
rm "${LAYER_ZIP}"

echo "Lambda Layer deployment complete!"

# Save the layer ARN to a file for reference
echo "LAMBDA_LAYER_ARN=${LAYER_VERSION_ARN}" > layer-arn.env

# Export the layer ARN as an environment variable
export LAMBDA_LAYER_ARN="${LAYER_VERSION_ARN}"

echo "Layer ARN saved to layer-arn.env and exported as LAMBDA_LAYER_ARN" 