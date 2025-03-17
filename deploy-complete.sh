#!/bin/bash

# Comprehensive deployment script for AWS Lambda functions

echo "Starting comprehensive deployment process..."

# Step 1: Set environment variables
echo "Step 1: Setting environment variables..."
source ./set-env-vars.sh

# Step 2: Update Lambda function code for update-call-status
echo "Step 2: Updating Lambda function code for update-call-status..."
aws lambda update-function-code \
  --function-name ailevelup-phone-call-mcp-dev-update-call-status \
  --zip-file fileb://update-call-status.zip \
  --region us-east-1

# Step 3: Update Lambda function code for make-call
echo "Step 3: Updating Lambda function code for make-call..."
aws lambda update-function-code \
  --function-name ailevelup-phone-call-mcp-dev-make-call \
  --zip-file fileb://simple-lambda-package.zip \
  --region us-east-1

# Step 4: Update environment variables for both functions
echo "Step 4: Updating environment variables for both functions..."
./update-lambda-env.sh

# Step 5: Verify deployment
echo "Step 5: Verifying deployment..."
echo "Checking update-call-status function..."
aws lambda get-function --function-name ailevelup-phone-call-mcp-dev-update-call-status --region us-east-1 --query "Configuration.[LastModified,Version]"

echo "Checking make-call function..."
aws lambda get-function --function-name ailevelup-phone-call-mcp-dev-make-call --region us-east-1 --query "Configuration.[LastModified,Version]"

echo "Deployment completed successfully!"
echo "You may want to test the functions to ensure they're working correctly." 