#!/bin/bash

# Exit on error
set -e

echo "Reorganizing Lambda layers..."

# Create the necessary directory structure
mkdir -p lambda-layers/utils/nodejs/lib
mkdir -p lambda-layers/utils/nodejs/utils
mkdir -p lambda-layers/utils/nodejs/services

# Copy lib files
cp functions/lib/* lambda-layers/utils/nodejs/lib/

# Copy utils files
cp functions/utils/* lambda-layers/utils/nodejs/utils/

# Copy services files
cp functions/services/* lambda-layers/utils/nodejs/services/

# Create the utils layer zip
cd lambda-layers/utils
zip -r ../utils-layer.zip nodejs/
cd ../..

# Get the account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Publish the updated utils layer
aws lambda publish-layer-version \
    --layer-name ailevelup-phone-call-mcp-staging-utils \
    --description "Utils layer for AilevelUp Phone Call MCP" \
    --zip-file fileb://lambda-layers/utils-layer.zip \
    --compatible-runtimes nodejs22.x \
    --region us-east-1

# Save the layer ARN to a file
aws lambda list-layer-versions \
    --layer-name ailevelup-phone-call-mcp-staging-utils \
    --region us-east-1 \
    --query 'LayerVersions[0].LayerVersionArn' \
    --output text > lambda-layers/utils-layer-arn.env

echo "Utils layer reorganized and published successfully!" 