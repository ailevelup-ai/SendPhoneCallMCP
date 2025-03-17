#!/bin/bash

# Deployment script for Lambda functions with Layers
set -e  # Exit on error

ENVIRONMENT="staging"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"
RUNTIME="nodejs22.x"  # Updated runtime version
LAYER_DIR="lambda-layers"
FUNCTIONS_DIR="functions-slim"

echo "===================================================================="
echo "Deploying AilevelUp Phone Call MCP service with Lambda Layers"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"
echo "Runtime: ${RUNTIME}"
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

# Check if layer ARN files exist
echo "Checking for Lambda Layers..."
if [ ! -f "${LAYER_DIR}/dependencies-layer-arn.env" ] || [ ! -f "${LAYER_DIR}/utils-layer-arn.env" ]; then
  echo "Error: Lambda Layer ARN files not found. Run create-lambda-layers.sh first."
  exit 1
fi

# Load layer ARNs
source "${LAYER_DIR}/dependencies-layer-arn.env"
source "${LAYER_DIR}/utils-layer-arn.env"

# Create directory for slim function packages
mkdir -p "${FUNCTIONS_DIR}"

# New function to wait for Lambda function update to complete
wait_for_lambda_ready() {
  local function_name=$1
  local region=$2
  local status="InProgress"
  echo "Waiting for function ${function_name} to be ready..."
  
  while [[ "$status" == "InProgress" ]]; do
    sleep 5
    status=$(aws lambda get-function --function-name ${function_name} --region ${region} --query 'Configuration.LastUpdateStatus' --output text)
    echo "Current status: ${status}"
  done
  
  if [[ "$status" != "Successful" ]]; then
    echo "Error: Function update failed with status: ${status}"
    exit 1
  fi
  
  echo "Function ${function_name} is ready for more updates."
}

# Step 1: Deploy Lambda functions
echo "Preparing slim function packages..."
LAMBDA_FUNCTIONS=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

# For each function, create a slim package with just the function code
for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  FUNCTION_FILE="functions/${FUNCTION}.js"
  PACKAGE_DIR="${FUNCTIONS_DIR}/${FUNCTION}"
  ZIP_FILE="${FUNCTIONS_DIR}/${FUNCTION}.zip"
  
  if [ ! -f "${FUNCTION_FILE}" ]; then
    echo "Warning: Function file ${FUNCTION_FILE} not found. Skipping."
    continue
  fi
  
  echo "Preparing slim package for: ${FUNCTION_NAME}"
  
  # Create package directory
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"
  
  # Copy function file
  cp "${FUNCTION_FILE}" "${PACKAGE_DIR}/"
  
  # Copy index.js handler if it exists
  if [ -f "functions/index.js" ]; then
    cp "functions/index.js" "${PACKAGE_DIR}/"
  elif [ -f "index.js" ]; then
    cp "index.js" "${PACKAGE_DIR}/"
  fi
  
  # Load environment variables into the package
  grep -v '^#' .env.staging > "${PACKAGE_DIR}/.env"
  
  # Create slim zip file
  echo "Creating slim zip for ${FUNCTION}..."
  mkdir -p "${FUNCTIONS_DIR}"
  ZIP_FILE_ABSOLUTE="$(pwd)/${ZIP_FILE}"
  echo "Creating zip file at: ${ZIP_FILE_ABSOLUTE}"
  
  if [ -d "${PACKAGE_DIR}" ]; then
    echo "Package directory exists: ${PACKAGE_DIR}"
    echo "Contents of package directory:"
    ls -la "${PACKAGE_DIR}"
    
    # Create the zip file from outside the directory
    (cd "${PACKAGE_DIR}" && zip -r "${ZIP_FILE_ABSOLUTE}" .)
    
    # Verify zip was created
    if [ -f "${ZIP_FILE_ABSOLUTE}" ]; then
      echo "Zip file created successfully: ${ZIP_FILE_ABSOLUTE}"
      ls -la "${ZIP_FILE_ABSOLUTE}"
    else
      echo "Error: Failed to create zip file at ${ZIP_FILE_ABSOLUTE}"
      exit 1
    fi
  else
    echo "Error: Package directory ${PACKAGE_DIR} does not exist"
    exit 1
  fi
  
  echo "Deploying Lambda function: ${FUNCTION_NAME}"
  
  # Check if function exists
  FUNCTION_EXISTS=$(aws lambda list-functions --region ${REGION} --query "Functions[?FunctionName=='${FUNCTION_NAME}'].FunctionName" --output text)
  
  # Create/update the function with layers
  if [ -z "${FUNCTION_EXISTS}" ]; then
    echo "Creating new Lambda function: ${FUNCTION_NAME} with layers"
    aws lambda create-function \
      --function-name "${FUNCTION_NAME}" \
      --runtime "${RUNTIME}" \
      --handler "index.handler" \
      --role "arn:aws:iam::$(aws sts get-caller-identity --query 'Account' --output text):role/lambda-basic-execution" \
      --zip-file "fileb://${ZIP_FILE}" \
      --layers "${DEPENDENCIES_LAYER_ARN}" "${UTILS_LAYER_ARN}" \
      --region ${REGION} \
      --timeout 30 \
      --memory-size 512
  else
    echo "Updating existing Lambda function: ${FUNCTION_NAME} with layers"
    # Update code
    aws lambda update-function-code \
      --function-name "${FUNCTION_NAME}" \
      --zip-file "fileb://${ZIP_FILE}" \
      --region ${REGION}
    
    # Wait for the code update to complete
    wait_for_lambda_ready "${FUNCTION_NAME}" "${REGION}"
    
    # Update configuration including runtime
    aws lambda update-function-configuration \
      --function-name "${FUNCTION_NAME}" \
      --runtime "${RUNTIME}" \
      --layers "${DEPENDENCIES_LAYER_ARN}" "${UTILS_LAYER_ARN}" \
      --region ${REGION}
      
    # Wait for the configuration update to complete
    wait_for_lambda_ready "${FUNCTION_NAME}" "${REGION}"
  fi
  
  echo "${FUNCTION_NAME} deployed successfully with layers."
done

# Step 2: Create API Gateway (if needed)
echo "Setting up API Gateway..."
./create-api-gateway.sh ${ENVIRONMENT} ${REGION}

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
echo "Deployment with Lambda Layers completed successfully!"
echo "===================================================================="
echo "Lambda Functions deployed: ${LAMBDA_FUNCTIONS[*]}"
echo "Lambda Layers used:"
echo "  - Dependencies: ${DEPENDENCIES_LAYER_ARN}"
echo "  - Utils: ${UTILS_LAYER_ARN}"
echo "API Gateway: Check in AWS Console"
echo "CloudWatch Dashboard: ${DASHBOARD_NAME}"
echo "====================================================================" 