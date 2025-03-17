#!/bin/bash

# Comprehensive deployment script for AWS Lambda functions

echo "Starting comprehensive deployment process..."

# Step 1: Set environment variables
echo "Step 1: Setting environment variables..."
source ./set-env-vars.sh
if [ $? -ne 0 ]; then
  echo "Failed to set environment variables. Please check your .env or .env.staging file."
  exit 1
fi

# Step 2: Create deployment packages
echo "Step 2: Creating deployment packages..."

# Create deployment package for make-call function
echo "Creating deployment package for make-call function..."
cd simple-lambda
zip -r ../make-call-deployment.zip index.js node_modules
if [ $? -ne 0 ]; then
  echo "Failed to create deployment package for make-call function."
  exit 1
fi
cd ..

# Create deployment package for check-call-status function
echo "Creating deployment package for check-call-status function..."
# Check if check-call-status.js exists
if [ -f check-call-status.js ]; then
  # Create a temporary directory for check-call-status
  mkdir -p check-call-status-temp
  cp check-call-status.js check-call-status-temp/index.js
  # Copy node_modules from simple-lambda if needed
  if [ ! -d check-call-status-temp/node_modules ]; then
    cp -r simple-lambda/node_modules check-call-status-temp/
  fi
  cd check-call-status-temp
  zip -r ../check-call-status-deployment.zip index.js node_modules
  if [ $? -ne 0 ]; then
    echo "Failed to create deployment package for check-call-status function."
    exit 1
  fi
  cd ..
  # Clean up temporary directory
  rm -rf check-call-status-temp
else
  echo "Warning: check-call-status.js not found. Using existing check-call-status-deployment.zip if available."
  # If we don't have a deployment zip, use the simple-lambda-package.zip as a fallback
  if [ ! -f check-call-status-deployment.zip ] && [ -f simple-lambda-package.zip ]; then
    cp simple-lambda-package.zip check-call-status-deployment.zip
  fi
fi

# Step 3: Update Lambda functions
echo "Step 3: Updating Lambda functions..."

# Update make-call function
echo "Updating make-call function..."
aws lambda update-function-code \
  --function-name ailevelup-phone-call-mcp-staging-make-call \
  --zip-file fileb://make-call-deployment.zip \
  --region us-east-1
if [ $? -ne 0 ]; then
  echo "Failed to update make-call function."
  exit 1
fi

# Update check-call-status function
echo "Updating check-call-status function..."
aws lambda update-function-code \
  --function-name ailevelup-phone-call-mcp-staging-check-call-status \
  --zip-file fileb://check-call-status-deployment.zip \
  --region us-east-1
if [ $? -ne 0 ]; then
  echo "Failed to update check-call-status function."
  exit 1
fi

# Step 4: Update environment variables
echo "Step 4: Updating environment variables..."
./update-lambda-env.sh
if [ $? -ne 0 ]; then
  echo "Failed to update environment variables."
  exit 1
fi

# Step 5: Verify deployment
echo "Step 5: Verifying deployment..."
aws lambda get-function \
  --function-name ailevelup-phone-call-mcp-staging-make-call \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,LastModified]'

aws lambda get-function \
  --function-name ailevelup-phone-call-mcp-staging-check-call-status \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,LastModified]'

echo "Deployment complete! Run ./test-lambda-functions.sh to test the functions." 