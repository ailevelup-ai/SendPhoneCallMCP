#!/bin/bash
set -e

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
fi

echo "Starting deployment to $ENVIRONMENT environment in $REGION region..."

# Make all scripts executable
chmod +x create-lambda-layer.sh
chmod +x deploy-lambda-functions.sh
chmod +x setup-api-gateway.sh
chmod +x setup-eventbridge.sh

# Step 1: Create Lambda Layer
echo "Step 1: Creating Lambda Layer..."
./create-lambda-layer.sh "$ENVIRONMENT" "$REGION"
echo "Lambda Layer created successfully."
echo

# Step 2: Deploy Lambda Functions
echo "Step 2: Deploying Lambda Functions..."
./deploy-lambda-functions.sh "$ENVIRONMENT" "$REGION"
echo "Lambda Functions deployed successfully."
echo

# Step 3: Set up API Gateway
echo "Step 3: Setting up API Gateway..."
./setup-api-gateway.sh "$ENVIRONMENT" "$REGION"
echo "API Gateway set up successfully."
echo

# Step 4: Set up EventBridge Rule
echo "Step 4: Setting up EventBridge rule..."
./setup-eventbridge.sh "$ENVIRONMENT" "$REGION"
echo "EventBridge rule set up successfully."
echo

echo "Deployment completed successfully!" 