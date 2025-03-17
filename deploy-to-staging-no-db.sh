#!/bin/bash

# Deployment script for Staging environment (skipping DB creation)
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

# Step 1: Load environment variables from .env.staging
echo "Loading environment variables from .env.staging..."
if [ ! -f .env.staging ]; then
  echo "Error: .env.staging file not found"
  exit 1
fi

# Check for required tools
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

# Step 2: Deploy Lambda functions
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
  FUNCTION_FILE="functions/${FUNCTION}.js"
  
  if [ ! -f "${FUNCTION_FILE}" ]; then
    echo "Warning: Function file ${FUNCTION_FILE} not found. Skipping."
    continue
  fi
  
  echo "Deploying Lambda function: ${FUNCTION_NAME}"
  
  # Create zip file for the function
  echo "Creating zip package..."
  PACKAGE_DIR="deployment-package-${FUNCTION}"
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
  
  # Copy node_modules if they exist
  if [ -d "node_modules" ]; then
    cp -r node_modules "${PACKAGE_DIR}/"
  fi
  
  # Load environment variables into the package
  grep -v '^#' .env.staging > "${PACKAGE_DIR}/.env"
  
  # Create zip file
  (cd "${PACKAGE_DIR}" && zip -r "../${PACKAGE_DIR}.zip" .)
  
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
      --zip-file "fileb://${PACKAGE_DIR}.zip" \
      --timeout 30 \
      --memory-size 256 \
      --region ${REGION}
  else
    # Update function
    echo "Updating existing Lambda function: ${FUNCTION_NAME}"
    aws lambda update-function-code \
      --function-name "${FUNCTION_NAME}" \
      --zip-file "fileb://${PACKAGE_DIR}.zip" \
      --region ${REGION}
      
    # Update configuration
    aws lambda update-function-configuration \
      --function-name "${FUNCTION_NAME}" \
      --handler "index.handler" \
      --timeout 30 \
      --memory-size 256 \
      --region ${REGION}
  fi
  
  # Clean up
  rm -rf "${PACKAGE_DIR}" "${PACKAGE_DIR}.zip"
  
  echo "Lambda function ${FUNCTION_NAME} deployed successfully."
done

# Step 3: Create API Gateway
echo "Creating API Gateway..."
chmod +x create-api-gateway-shell.sh
./create-api-gateway-shell.sh ${ENVIRONMENT} ${REGION}

# Step 4: Set up CloudWatch Dashboard
echo "Setting up CloudWatch Dashboard..."
DASHBOARD_NAME="${STACK_NAME}-dashboard"

# Create dashboard JSON
cat > "dashboard.json" << EOF
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
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-make-call" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-list-calls" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-call-details" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-update-call-status" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-voice-options" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-model-options" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "Lambda Invocations",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-make-call" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-list-calls" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-call-details" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-update-call-status" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-voice-options" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-model-options" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "Lambda Errors",
        "period": 300
      }
    }
  ]
}
EOF

# Create or update dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "${DASHBOARD_NAME}" \
  --dashboard-body "$(cat dashboard.json)" \
  --region ${REGION}

# Clean up
rm -f dashboard.json

echo "Deployment completed successfully!"
echo "Note: DynamoDB tables were skipped in this deployment." 