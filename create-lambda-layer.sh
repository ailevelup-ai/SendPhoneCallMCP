#!/bin/bash
set -e

# Use the Homebrew-installed AWS CLI
AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
fi

echo "Creating Lambda Layer for $ENVIRONMENT environment in $REGION region..."

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"
LAYER_NAME="${STACK_NAME}-dependencies"

# Create directory structure required for Lambda Layers
echo "Packaging dependencies for Lambda Layer..."
rm -rf layer-dist
mkdir -p layer-dist/nodejs

# Copy package.json and package-lock.json to the layer directory
cp package.json layer-dist/nodejs/
cp package-lock.json layer-dist/nodejs/

# Install production dependencies in the layer directory
cd layer-dist/nodejs
npm install --production
cd ../..

# Create the layer zip
echo "Creating layer zip file..."
cd layer-dist
zip -r ../layer.zip .
cd ..

# Check if the layer already exists
LAYER_VERSION_ARN=$($AWS_CLI lambda list-layer-versions --layer-name $LAYER_NAME --query 'LayerVersions[0].LayerVersionArn' --output text 2>/dev/null || echo "")

if [ -z "$LAYER_VERSION_ARN" ] || [ "$LAYER_VERSION_ARN" == "None" ]; then
  echo "Creating new Lambda Layer: $LAYER_NAME"
  LAYER_VERSION_ARN=$($AWS_CLI lambda publish-layer-version \
    --layer-name $LAYER_NAME \
    --description "Dependencies for $SERVICE_NAME" \
    --zip-file fileb://layer.zip \
    --compatible-runtimes nodejs22.x \
    --query 'LayerVersionArn' \
    --output text)
else
  echo "Updating Lambda Layer: $LAYER_NAME"
  LAYER_VERSION_ARN=$($AWS_CLI lambda publish-layer-version \
    --layer-name $LAYER_NAME \
    --description "Dependencies for $SERVICE_NAME" \
    --zip-file fileb://layer.zip \
    --compatible-runtimes nodejs22.x \
    --query 'LayerVersionArn' \
    --output text)
fi

echo "Lambda Layer created/updated with ARN: $LAYER_VERSION_ARN"
echo "LAYER_ARN=$LAYER_VERSION_ARN" > layer-arn.env

# Clean up
rm -rf layer-dist
echo "Lambda Layer deployment completed successfully!" 