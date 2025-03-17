#!/bin/bash

# Deployment script for Staging environment using pre-created packages
set -e  # Exit on error

ENVIRONMENT="staging"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "===================================================================="
echo "Deploying AilevelUp Phone Call MCP service to ${ENVIRONMENT} environment"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"
echo "===================================================================="

# Check for required tools and files
echo "Testing AWS CLI access..."
aws sts get-caller-identity > /dev/null || {
  echo "Error: AWS CLI is not configured or lacks permissions"
  exit 1
}
echo "AWS CLI is properly configured."

echo "Checking for jq..."
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed. Please install jq for JSON processing."
  exit 1
fi

# Check if deployment packages exist
echo "Checking for deployment packages..."
if [ ! -d "deployment-packages" ]; then
  echo "Error: deployment-packages directory not found. Run prepare-deployment-packages.sh first."
  exit 1
fi

# Step 1: Deploy Lambda functions
echo "Deploying Lambda functions..."
LAMBDA_FUNCTIONS=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  ZIP_FILE="deployment-packages/${FUNCTION}.zip"
  
  if [ ! -f "${ZIP_FILE}" ]; then
    echo "Warning: Package ${ZIP_FILE} not found. Skipping."
    continue
  fi
  
  echo "Deploying Lambda function: ${FUNCTION_NAME}"
  
  # Check if function exists
  FUNCTION_EXISTS=$(aws lambda list-functions --region ${REGION} --query "Functions[?FunctionName=='${FUNCTION_NAME}'].FunctionName" --output text)
  
  if [ -z "${FUNCTION_EXISTS}" ]; then
    # Create function
    echo "Creating new Lambda function: ${FUNCTION_NAME}"
    aws lambda create-function \
      --function-name "${FUNCTION_NAME}" \
      --runtime nodejs18.x \
      --handler "index.handler" \
      --role "arn:aws:iam::$(aws sts get-caller-identity --query 'Account' --output text):role/lambda-basic-execution" \
      --zip-file "fileb://${ZIP_FILE}" \
      --region ${REGION} \
      --timeout 30 \
      --memory-size 512
  else
    # Update function
    echo "Updating existing Lambda function: ${FUNCTION_NAME}"
    aws lambda update-function-code \
      --function-name "${FUNCTION_NAME}" \
      --zip-file "fileb://${ZIP_FILE}" \
      --region ${REGION}
  fi
  
  echo "${FUNCTION_NAME} deployed successfully."
done

# Step 2: Create API Gateway (if needed)
echo "Setting up API Gateway..."
./create-api-gateway-shell.sh ${ENVIRONMENT} ${REGION}

# Step 3: Set up CloudWatch Dashboard
echo "Setting up CloudWatch Dashboard..."
DASHBOARD_NAME="${STACK_NAME}-dashboard"

# Create dashboard JSON
DASHBOARD_JSON=$(cat << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
EOF
)

# Add metrics for each Lambda function
for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  DASHBOARD_JSON+=$(cat << EOF
          [ "AWS/Lambda", "Invocations", "FunctionName", "${FUNCTION_NAME}" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${FUNCTION_NAME}" ],
EOF
)
done

# Close the dashboard JSON
DASHBOARD_JSON+=$(cat << EOF
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "stat": "Sum",
        "period": 300,
        "title": "Lambda Invocations and Errors"
      }
    }
  ]
}
EOF
)

# Create or update CloudWatch Dashboard
echo "Creating/updating CloudWatch Dashboard: ${DASHBOARD_NAME}"
aws cloudwatch put-dashboard \
  --dashboard-name "${DASHBOARD_NAME}" \
  --dashboard-body "${DASHBOARD_JSON}" \
  --region ${REGION}

echo "===================================================================="
echo "Deployment completed successfully!"
echo "===================================================================="
echo "Lambda Functions deployed: ${LAMBDA_FUNCTIONS[*]}"
echo "API Gateway: Check in AWS Console"
echo "CloudWatch Dashboard: ${DASHBOARD_NAME}"
echo "====================================================================" 